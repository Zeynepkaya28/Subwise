import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as jose from 'jose';
import { UsersService } from '../users/users.service';

export type RequestUser = {
  sub: string;
  email: string;
  tenantId: string;
  authSource: 'local' | 'oidc';
};

@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = auth.slice(7).trim();
    const issuer = this.config.get<string>('oidc.issuer');
    const jwksUri = this.config.get<string>('oidc.jwksUri');
    const audience = this.config.get<string>('oidc.audience');

    if (issuer && jwksUri) {
      try {
        const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
        const { payload } = await jose.jwtVerify(token, JWKS, {
          issuer,
          audience: audience || undefined,
        });
        const sub = String(payload.sub);
        const email =
          typeof payload.email === 'string' ? payload.email : undefined;
        const user = await this.users.upsertFromOidc(issuer, sub, email);
        req.user = {
          sub: user.id,
          email: user.email,
          tenantId: user.tenantId,
          authSource: 'oidc',
        } satisfies RequestUser;
        return true;
      } catch {
        /* fall through to local JWT */
      }
    }

    try {
      const p = this.jwt.verify<{
        sub: string;
        email: string;
        tenantId: string;
        typ?: string;
        iss?: string;
      }>(token);
      if (p.typ !== 'access' || p.iss !== 'secure-finance-api') {
        throw new UnauthorizedException('Invalid access token');
      }
      req.user = {
        sub: p.sub,
        email: p.email,
        tenantId: p.tenantId,
        authSource: 'local',
      } satisfies RequestUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
