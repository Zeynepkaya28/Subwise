import { Body, Controller, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AnyAuthGuard, RequestUser } from '../guards/any-auth.guard';
import { ClientEnvelopeDto } from './dto/client-envelope.dto';
import { ServerEncryptIngestDto } from './dto/server-encrypt-ingest.dto';
import { IngestionService } from './ingestion.service';

@Controller('ingest')
@UseGuards(AnyAuthGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post('server-encrypt')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async serverEncrypt(
    @Body() dto: ServerEncryptIngestDto,
    @Req() req: Request & { user: RequestUser },
    @Ip() ip: string,
  ) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.ingestion.ingestServerEncrypted(
      req.user.sub,
      req.user.tenantId,
      dto,
      clientIp,
    );
  }

  @Post('envelope')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async envelope(
    @Body() dto: ClientEnvelopeDto,
    @Req() req: Request & { user: RequestUser },
    @Ip() ip: string,
  ) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.ingestion.ingestClientEnvelope(
      req.user.sub,
      req.user.tenantId,
      dto,
      clientIp,
    );
  }
}
