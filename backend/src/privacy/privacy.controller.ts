import { Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AnyAuthGuard, RequestUser } from '../guards/any-auth.guard';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
@UseGuards(AnyAuthGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 86_400_000 } })
  export(@Req() req: Request & { user: RequestUser }, @Ip() ip: string) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.privacy.exportUserData(
      req.user.sub,
      req.user.tenantId,
      clientIp,
    );
  }

  @Post('erase')
  @Throttle({ default: { limit: 3, ttl: 86_400_000 } })
  erase(@Req() req: Request & { user: RequestUser }, @Ip() ip: string) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.privacy.eraseAllUserData(
      req.user.sub,
      req.user.tenantId,
      clientIp,
    );
  }
}
