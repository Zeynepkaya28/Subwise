import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum StorageMode {
  SERVER_ENCRYPTED = 'server_encrypted',
  CLIENT_ENVELOPE = 'client_envelope',
}

@Entity('financial_payloads')
export class FinancialPayload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.payloads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'storage_mode', type: 'enum', enum: StorageMode })
  storageMode: StorageMode;

  /** Base64 ciphertext — never plaintext at rest */
  @Column({ type: 'text' })
  ciphertext: string;

  @Column({ type: 'varchar', length: 64 })
  iv: string;

  @Column({ name: 'auth_tag', type: 'varchar', length: 64 })
  authTag: string;

  @Column({ default: 'aes-256-gcm' })
  algorithm: string;

  @Column({ name: 'key_version', type: 'int', default: 1 })
  keyVersion: number;

  /** Optional: DEK wrapped for KMS (E2EE path); server does not decrypt without KMS */
  @Column({ name: 'wrapped_dek', type: 'text', nullable: true })
  wrappedDek: string | null;

  /** Minimal metadata only (counts, checksum) — no raw transaction text */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
