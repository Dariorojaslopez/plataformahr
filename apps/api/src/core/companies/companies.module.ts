import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { CompanyContextGuard } from '../../tenant/guards/company-context.guard';
import { BrandingController } from './branding/branding.controller';
import { BrandingService } from './branding/branding.service';
import { AtsTemplatesController } from './ats-templates/ats-templates.controller';
import { AtsTemplatesService } from './ats-templates/ats-templates.service';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, RbacModule, AuditModule],
  controllers: [CompaniesController, BrandingController, AtsTemplatesController],
  providers: [
    CompaniesService,
    BrandingService,
    AtsTemplatesService,
    CompanyContextGuard,
    PermissionGuard,
  ],
  exports: [CompaniesService, BrandingService, AtsTemplatesService],
})
export class CompaniesModule {}
