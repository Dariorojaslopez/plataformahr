import type { AuthenticatedUser, TenantContext } from '../../auth/auth.types';
import { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';
import { CreateReportingLineDto } from '../reporting-lines/dto/reporting-line.dto';
import { ReportingLinesService } from '../reporting-lines/reporting-lines.service';
export declare class EmployeesController {
    private readonly employeesService;
    private readonly reportingLinesService;
    constructor(employeesService: EmployeesService, reportingLinesService: ReportingLinesService);
    list(tenant: TenantContext, query: ListEmployeesQueryDto): Promise<{
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
            positionId: string;
            hireDate: Date | null;
            terminationDate: Date | null;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getById(tenant: TenantContext, id: string): Promise<{
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
        positionId: string;
        hireDate: Date | null;
        terminationDate: Date | null;
    }>;
    organizationProfile(tenant: TenantContext, id: string): Promise<{
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
    listReportingLines(tenant: TenantContext, id: string): Promise<({
        manager: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            status: import("@prisma/client").$Enums.EmployeeStatus;
        };
    } & {
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.ReportingLineType;
        updatedAt: Date;
        employeeId: string;
        managerEmployeeId: string;
    })[]>;
    create(tenant: TenantContext, user: AuthenticatedUser, dto: CreateEmployeeDto): Promise<{
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
        positionId: string;
        hireDate: Date | null;
        terminationDate: Date | null;
    }>;
    update(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: UpdateEmployeeDto): Promise<{
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
        positionId: string;
        hireDate: Date | null;
        terminationDate: Date | null;
    }>;
    createReportingLine(tenant: TenantContext, user: AuthenticatedUser, id: string, dto: CreateReportingLineDto): Promise<{
        id: string;
        companyId: string;
        createdAt: Date;
        type: import("@prisma/client").$Enums.ReportingLineType;
        updatedAt: Date;
        employeeId: string;
        managerEmployeeId: string;
    }>;
    removeReportingLine(tenant: TenantContext, user: AuthenticatedUser, id: string, reportingLineId: string): Promise<{
        success: boolean;
    }>;
}
