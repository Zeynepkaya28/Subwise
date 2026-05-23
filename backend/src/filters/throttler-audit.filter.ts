import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../entities/security-audit.entity';

@Catch(ThrottlerException)
export class ThrottlerAuditFilter implements ExceptionFilter {
  constructor(private readonly audit: AuditService) {}

  async catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const xf = req.headers['x-forwarded-for'];
    const ip =
      typeof xf === 'string' ? xf.split(',')[0].trim() : req.ip ?? null;
    const user = (req as Request & { user?: { sub?: string; tenantId?: string } })
      .user;
    await this.audit.log({
      eventType: AuditEventType.RATE_LIMIT,
      userId: user?.sub ?? null,
      tenantId: user?.tenantId ?? null,
      ip,
      details: { path: req.path, method: req.method },
    });
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too many requests',
    });
  }
}
