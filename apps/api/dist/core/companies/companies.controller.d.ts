import type { TenantContext } from '../../auth/auth.types';
import { CompaniesService } from './companies.service';
export declare class CompaniesController {
    private readonly companiesService;
    constructor(companiesService: CompaniesService);
    getCurrent(tenant: TenantContext): Promise<{
        id: string;
        name: string;
        slug: string;
        status: import("@prisma/client").$Enums.CompanyStatus;
        defaultLanguage: import("@prisma/client").$Enums.Language;
    }>;
}
