import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../entities/security-audit.entity';
import { UsersService } from '../users/users.service';

type AccessPayload = {
  sub: string;
  email: string;
  tenantId: string;
  typ: 'access';
  iss: string;
};

type RefreshPayload = {
  sub: string;
  typ: 'refresh';
  ver: number;
  iss: string;
};

@Injectable()
export class AuthService {
  private readonly issuer = 'secure-finance-api';

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get accessExpires() {
    return this.config.get<string>('jwt.accessExpires') ?? '15m';
  }

  private get refreshExpires() {
    const days = this.config.get<number>('jwt.refreshExpiresDays') ?? 14;
    return `${days}d`;
  }

  async register(email: string, password: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const hash = await bcrypt.hash(password, 12);
    const tenantId = randomUUID();
    const user = await this.users.createLocalUser(email, hash, tenantId);
    return this.issueTokens(user.id, user.email, user.tenantId, user.refreshTokenVersion);
  }

  async login(email: string, password: string, ip?: string | null) {
    const user = await this.users.findByEmail(email);
    if (!user?.passwordHash) {
      await this.audit.log({
        eventType: AuditEventType.LOGIN_FAILURE,
        ip,
        details: { reason: 'user_not_found', email: email.toLowerCase() },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        eventType: AuditEventType.LOGIN_FAILURE,
        userId: user.id,
        tenantId: user.tenantId,
        ip,
        details: { reason: 'bad_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.audit.log({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      tenantId: user.tenantId,
      ip,
      details: {},
    });
    return this.issueTokens(
      user.id,
      user.email,
      user.tenantId,
      user.refreshTokenVersion,
    );
  }

  /**
   * Refresh token rotation: version mismatch => reuse / revoked.
   */
  async rotateRefreshToken(refreshToken: string, ip?: string | null) {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken);
    } catch {
      await this.audit.log({
        eventType: AuditEventType.SUSPICIOUS,
        ip,
        details: { reason: 'invalid_refresh_jwt' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh' || payload.iss !== this.issuer) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (user.refreshTokenVersion !== payload.ver) {
      await this.audit.log({
        eventType: AuditEventType.REFRESH_REUSE,
        userId: user.id,
        tenantId: user.tenantId,
        ip,
        details: { reason: 'version_mismatch', tokenVer: payload.ver, currentVer: user.refreshTokenVersion },
      });
      throw new UnauthorizedException('Refresh token revoked or reused');
    }
    await this.users.bumpRefreshVersion(user.id);
    const updated = await this.users.findById(user.id);
    if (!updated) throw new UnauthorizedException('Invalid refresh token');
    await this.audit.log({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: updated.id,
      tenantId: updated.tenantId,
      ip,
      details: { reason: 'refresh_rotated' },
    });
    return this.issueTokens(
      updated.id,
      updated.email,
      updated.tenantId,
      updated.refreshTokenVersion,
    );
  }

  private issueTokens(
    userId: string,
    email: string,
    tenantId: string,
    refreshVersion: number,
  ) {
    const accessPayload: AccessPayload = {
      sub: userId,
      email,
      tenantId,
      typ: 'access',
      iss: this.issuer,
    };
    const refreshPayload: RefreshPayload = {
      sub: userId,
      typ: 'refresh',
      ver: refreshVersion,
      iss: this.issuer,
    };
    const access_token = this.jwt.sign(accessPayload as object, {
      expiresIn: this.accessExpires,
    });
    const refresh_token = this.jwt.sign(refreshPayload as object, {
      expiresIn: this.refreshExpires,
    });
    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }
}
