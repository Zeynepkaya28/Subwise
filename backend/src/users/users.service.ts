import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Link or create user from OIDC subject (sub) stored as synthetic email oidc:{sub}@{issuer host}
   * Production: separate oidc_sub column + issuer.
   */
  async upsertFromOidc(
    issuer: string,
    sub: string,
    _email?: string,
  ): Promise<User> {
    let host = issuer;
    try {
      host = new URL(issuer).host;
    } catch {
      host = issuer.replace(/^https?:\/\//, '').split('/')[0];
    }
    const syntheticEmail = `oidc:${sub}@${host}`.toLowerCase();
    let user = await this.repo.findOne({ where: { email: syntheticEmail } });
    if (!user) {
      user = this.repo.create({
        email: syntheticEmail,
        passwordHash: null,
        tenantId: randomUUID(),
        refreshTokenHash: null,
      });
      await this.repo.save(user);
    }
    return user;
  }

  async createLocalUser(
    email: string,
    passwordHash: string,
    tenantId: string,
  ): Promise<User> {
    const user = this.repo.create({
      email: email.toLowerCase(),
      passwordHash,
      tenantId,
      refreshTokenHash: null,
    });
    return this.repo.save(user);
  }

  async setRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.repo.update({ id: userId }, { refreshTokenHash: hash });
  }

  async bumpRefreshVersion(userId: string): Promise<void> {
    await this.repo.increment({ id: userId }, 'refreshTokenVersion', 1);
  }

  async removeUserCascade(userId: string): Promise<void> {
    await this.repo.delete({ id: userId });
  }
}
