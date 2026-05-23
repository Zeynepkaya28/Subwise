import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export interface EncryptedBlob {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
  keyVersion: number;
}

@Injectable()
export class CryptoService implements OnModuleInit {
  private masterKey: Buffer;
  private readonly keyVersion = 1;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const b64 = this.config.get<string>('masterEncryptionKeyB64');
    if (!b64 || b64.length < 32) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY must be set to a base64-encoded 32-byte key (see .env.example).',
      );
    }
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== KEY_LEN) {
      throw new Error('MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
    this.masterKey = buf;
  }

  encryptUtf8(plaintext: string): EncryptedBlob {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, this.masterKey, iv, {
      authTagLength: TAG_LEN,
    });
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertextB64: enc.toString('base64'),
      ivB64: iv.toString('base64'),
      tagB64: tag.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  decryptUtf8(blob: EncryptedBlob): string {
    const iv = Buffer.from(blob.ivB64, 'base64');
    const tag = Buffer.from(blob.tagB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, this.masterKey, iv, {
      authTagLength: TAG_LEN,
    });
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }
}
