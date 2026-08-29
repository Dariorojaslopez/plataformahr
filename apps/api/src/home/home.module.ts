import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../core/audit/audit.module';
import { RbacModule } from '../core/rbac/rbac.module';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { CompanyContextGuard } from '../tenant/guards/company-context.guard';
import { HomeController } from './home.controller';
import { HomeInfoService } from './home-info.service';
import { HomeService } from './home.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [HomeController],
  providers: [
    HomeService,
    HomeInfoService,
    CompanyContextGuard,
    PermissionGuard,
  ],
})
export class HomeModule {}
