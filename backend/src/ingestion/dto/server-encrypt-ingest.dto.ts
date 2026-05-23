import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TransactionRowDto {
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  description: string;

  @IsNumber()
  amount: number;
}

export class ServerEncryptIngestDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => TransactionRowDto)
  transactions: TransactionRowDto[];
}
