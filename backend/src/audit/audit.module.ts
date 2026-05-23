import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAuditLog } from '../entities/security-audit.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityAuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
