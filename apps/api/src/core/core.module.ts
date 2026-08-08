import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { CompaniesModule } from './companies/companies.module';
import { MembershipsModule } from './memberships/memberships.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    MembershipsModule,
    RbacModule,
    AuditModule,
  ],
  exports: [
    UsersModule,
    CompaniesModule,
    MembershipsModule,
    RbacModule,
    AuditModule,
  ],
})
export class CoreModule {}
