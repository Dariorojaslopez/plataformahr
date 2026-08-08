import { type Employee } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './dto/employee.dto';
export declare class EmployeesService {
    private readonly prisma;
    private readonly audit;
    private readonly integrity;
    constructor(prisma: PrismaService, audit: AuditService, integrity: OrganizationIntegrityService);
    list(companyId: string, query: ListEmployeesQueryDto): Promise<{
        items: {
            id: string;
            companyId: string;
            userId: string | null;
            createdAt: Date;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.EmployeeStatus;
            updatedAt: Date;
            deletedAt: Date | null;
            businessUnitId: string | null;
            areaId: string;
            phone: string | null;
            birthDate: Date | null;
            country: string | null;
            state: string | null;
            city: string | null;
            maritalStatus: string | null;
            childrenCount: number | null;
            housingType: string | null;
            emergencyContactName: string | null;
            emergencyContactPhone: string | null;
            hireDate: Date | null;
            terminationDate: Date | null;
            positionId: string;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getById(companyId: string, id: string): Promise<Employee>;
    getOrganizationProfile(companyId: string, id: string): Promise<{
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        status: import("@prisma/client").$Enums.EmployeeStatus;
        hireDate: Date | null;
        businessUnit: {
            id: string;
            name: string;
            code: string | null;
        } | null;
        area: {
            id: string;
            name: string;
            code: string | null;
        };
        position: {
            id: string;
            name: string;
            code: string | null;
        };
        jobLevel: {
            id: string;
            name: string;
            rank: number;
        } | null;
        directManager: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.EmployeeStatus;
        } | null;
        indirectManagers: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.EmployeeStatus;
        }[];
    }>;
    create(companyId: string, userId: string, dto: CreateEmployeeDto): Promise<Employee>;
    update(companyId: string, actorUserId: string, id: string, dto: UpdateEmployeeDto): Promise<Employee>;
    private rethrowUniqueConflict;
    private validateRelations;
}
