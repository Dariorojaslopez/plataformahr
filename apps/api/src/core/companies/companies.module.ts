import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RbacModule } from '../rbac/rbac.module';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyContextGuard, PermissionGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
