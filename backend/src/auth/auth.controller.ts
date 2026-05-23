import { Body, Controller, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.auth.login(dto.email, dto.password, clientIp);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request) {
    const xf = req.headers['x-forwarded-for'];
    const clientIp =
      typeof xf === 'string' ? xf.split(',')[0].trim() : ip;
    return this.auth.rotateRefreshToken(dto.refresh_token, clientIp);
  }
}
