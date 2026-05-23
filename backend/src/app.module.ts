import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { CryptoModule } from './crypto/crypto.module';
import { FinancialPayload } from './entities/financial-payload.entity';
import { SecurityAuditLog } from './entities/security-audit.entity';
import { User } from './entities/user.entity';
import { ThrottlerAuditFilter } from './filters/throttler-audit.filter';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrivacyModule } from './privacy/privacy.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AuditService } from './audit/audit.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [User, FinancialPayload, SecurityAuditLog],
        synchronize: config.get<boolean>('typeormSync'),
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
    CryptoModule,
    AuditModule,
    UsersModule,
    AuthModule,
    IngestionModule,
    PrivacyModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_FILTER,
      useFactory: (audit: AuditService) => new ThrottlerAuditFilter(audit),
      inject: [AuditService],
    },
  ],
})
export class AppModule {}
