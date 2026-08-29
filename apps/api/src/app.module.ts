import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AtsModule } from './ats/ats.module';
import { AuthModule } from './auth/auth.module';
import { SECURITY_CONFIG } from './config/security.constants';
import { validateSecurityEnv } from './config/security.config';
import { CoreModule } from './core/core.module';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { OrganizationModule } from './organization/organization.module';
import { GoalsModule } from './goals/goals.module';
import { HomeModule } from './home/home.module';
import { PerformanceModule } from './performance/performance.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({
  providers: [
    {
      provide: SECURITY_CONFIG,
      useFactory: () => validateSecurityEnv(process.env),
    },
  ],
  exports: [SECURITY_CONFIG],
})
class SecurityConfigModule {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    SecurityConfigModule,
    ObservabilityModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    CoreModule,
    AuthModule,
    OrganizationModule,
    AtsModule,
    PerformanceModule,
    GoalsModule,
    HomeModule,
    PlatformModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
