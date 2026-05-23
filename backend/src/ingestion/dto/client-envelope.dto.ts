import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Client-side envelope: server persists ciphertext without decrypting (E2EE storage path).
 */
export class ClientEnvelopeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  algorithm: string;

  @IsString()
  @MinLength(4)
  @MaxLength(10_000_000)
  ciphertext: string;

  @IsString()
  @MinLength(4)
  @MaxLength(256)
  iv: string;

  @IsString()
  @MinLength(4)
  @MaxLength(256)
  authTag: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  wrappedDek?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyId?: string;
}
