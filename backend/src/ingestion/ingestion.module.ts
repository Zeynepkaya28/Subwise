import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { FinancialPayload } from '../entities/financial-payload.entity';
import { AnyAuthGuard } from '../guards/any-auth.guard';
import { UsersModule } from '../users/users.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialPayload]),
    AuditModule,
    UsersModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService, AnyAuthGuard],
})
export class IngestionModule {}
