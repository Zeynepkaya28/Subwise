import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { FinancialPayload } from '../entities/financial-payload.entity';
import { SecurityAuditLog } from '../entities/security-audit.entity';
import { User } from '../entities/user.entity';
import { AnyAuthGuard } from '../guards/any-auth.guard';
import { UsersModule } from '../users/users.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialPayload, SecurityAuditLog, User]),
    AuditModule,
    UsersModule,
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService, AnyAuthGuard],
})
export class PrivacyModule {}
