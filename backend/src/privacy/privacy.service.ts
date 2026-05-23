import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { FinancialPayload } from '../entities/financial-payload.entity';
import { AuditEventType, SecurityAuditLog } from '../entities/security-audit.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FinancialPayload)
    private readonly payloads: Repository<FinancialPayload>,
    @InjectRepository(SecurityAuditLog)
    private readonly audits: Repository<SecurityAuditLog>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  async exportUserData(userId: string, tenantId: string, ip?: string | null) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    const rows = await this.payloads.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
    });
    const auditTail = await this.audits.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    await this.audit.log({
      eventType: AuditEventType.PRIVACY_EXPORT,
      userId,
      tenantId,
      ip,
      details: { payloadCount: rows.length },
    });
    return {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        tenant_id: user.tenantId,
        created_at: user.createdAt,
      },
      financial_payloads: rows.map((r) => ({
        id: r.id,
        storage_mode: r.storageMode,
        algorithm: r.algorithm,
        key_version: r.keyVersion,
        ciphertext: r.ciphertext,
        iv: r.iv,
        auth_tag: r.authTag,
        wrapped_dek: r.wrappedDek,
        metadata: r.metadata,
        created_at: r.createdAt,
      })),
      recent_security_events: auditTail.map((a) => ({
        id: a.id,
        event_type: a.eventType,
        created_at: a.createdAt,
        ip: a.ip,
        details: a.details,
      })),
    };
  }

  /**
   * Permanent erasure: payloads, audit rows for user, then user record.
   * Note: centralized backups must honor retention policy separately (ops).
   */
  async eraseAllUserData(userId: string, tenantId: string, ip?: string | null) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(FinancialPayload, { userId, tenantId });
      await manager.delete(SecurityAuditLog, { userId });
      await manager.delete(User, { id: userId });
    });

    const subjectHash = createHash('sha256').update(userId).digest('hex');
    await this.audit.log({
      eventType: AuditEventType.PRIVACY_ERASE,
      userId: null,
      tenantId: null,
      ip,
      details: {
        phase: 'completed',
        subject_hash: subjectHash,
        erasure_ref: randomBytes(16).toString('hex'),
      },
    });

    return { status: 'erased', subject_hash: subjectHash };
  }
}
