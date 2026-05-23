import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventType, SecurityAuditLog } from '../entities/security-audit.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(SecurityAuditLog)
    private readonly repo: Repository<SecurityAuditLog>,
  ) {}

  async log(params: {
    eventType: AuditEventType;
    userId?: string | null;
    tenantId?: string | null;
    ip?: string | null;
    details?: Record<string, unknown> | null;
  }): Promise<void> {
    const row = this.repo.create({
      eventType: params.eventType,
      userId: params.userId ?? null,
      tenantId: params.tenantId ?? null,
      ip: params.ip ?? null,
      details: params.details ?? null,
    });
    await this.repo.save(row);

    if (
      params.eventType === AuditEventType.LOGIN_FAILURE ||
      params.eventType === AuditEventType.REFRESH_REUSE ||
      params.eventType === AuditEventType.RATE_LIMIT ||
      params.eventType === AuditEventType.SUSPICIOUS
    ) {
      this.logger.warn(
        `Security: ${params.eventType} tenant=${params.tenantId ?? '-'} ip=${params.ip ?? '-'}`,
      );
    }
  }
}
