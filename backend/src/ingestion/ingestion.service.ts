import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../crypto/crypto.service';
import {
  FinancialPayload,
  StorageMode,
} from '../entities/financial-payload.entity';
import { AuditEventType } from '../entities/security-audit.entity';
import { ClientEnvelopeDto } from './dto/client-envelope.dto';
import { ServerEncryptIngestDto } from './dto/server-encrypt-ingest.dto';

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(FinancialPayload)
    private readonly payloads: Repository<FinancialPayload>,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Strip risky characters; never log raw payload. */
  private sanitizeDescription(s: string): string {
    return s
      .replace(/\0/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 512);
  }

  async ingestServerEncrypted(
    userId: string,
    tenantId: string,
    dto: ServerEncryptIngestDto,
    ip?: string | null,
  ) {
    const cleaned = dto.transactions.map((t) => ({
      date: String(t.date).trim(),
      description: this.sanitizeDescription(t.description),
      amount: Number(t.amount),
    }));
    if (cleaned.some((t) => !t.description || Number.isNaN(t.amount))) {
      throw new BadRequestException('Invalid transaction row after sanitization');
    }
    const plaintext = JSON.stringify(cleaned);
    const enc = this.crypto.encryptUtf8(plaintext);
    const row = this.payloads.create({
      userId,
      tenantId,
      storageMode: StorageMode.SERVER_ENCRYPTED,
      ciphertext: enc.ciphertextB64,
      iv: enc.ivB64,
      authTag: enc.tagB64,
      algorithm: 'aes-256-gcm',
      keyVersion: enc.keyVersion,
      wrappedDek: null,
      metadata: {
        recordCount: cleaned.length,
        source: 'server_encrypt_ingest',
      },
    });
    await this.payloads.save(row);
    await this.audit.log({
      eventType: AuditEventType.INGEST_SUCCESS,
      userId,
      tenantId,
      ip,
      details: { storageMode: StorageMode.SERVER_ENCRYPTED, id: row.id },
    });
    return { id: row.id, storage_mode: row.storageMode };
  }

  async ingestClientEnvelope(
    userId: string,
    tenantId: string,
    dto: ClientEnvelopeDto,
    ip?: string | null,
  ) {
    const row = this.payloads.create({
      userId,
      tenantId,
      storageMode: StorageMode.CLIENT_ENVELOPE,
      ciphertext: dto.ciphertext,
      iv: dto.iv,
      authTag: dto.authTag,
      algorithm: dto.algorithm,
      keyVersion: 0,
      wrappedDek: dto.wrappedDek ?? null,
      metadata: { source: 'client_envelope', keyId: dto.keyId ?? null },
    });
    await this.payloads.save(row);
    await this.audit.log({
      eventType: AuditEventType.INGEST_SUCCESS,
      userId,
      tenantId,
      ip,
      details: { storageMode: StorageMode.CLIENT_ENVELOPE, id: row.id },
    });
    return { id: row.id, storage_mode: row.storageMode };
  }
}
