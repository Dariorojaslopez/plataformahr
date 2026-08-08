import { EmployeeStatus } from '@prisma/client';
export declare class CreateEmployeeDto {
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
    phone?: string;
    birthDate?: string;
    country?: string;
    state?: string;
    city?: string;
    maritalStatus?: string;
    childrenCount?: number;
    housingType?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    businessUnitId?: string;
    areaId: string;
    positionId: string;
    status?: EmployeeStatus;
    hireDate?: string;
    terminationDate?: string;
}
export declare class UpdateEmployeeDto {
    firstName?: string;
    lastName?: string;
    email?: string;
    userId?: string | null;
    phone?: string;
    birthDate?: string | null;
    country?: string;
    state?: string;
    city?: string;
    maritalStatus?: string;
    childrenCount?: number | null;
    housingType?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    businessUnitId?: string | null;
    areaId?: string;
    positionId?: string;
    status?: EmployeeStatus;
    hireDate?: string | null;
    terminationDate?: string | null;
}
export declare class ListEmployeesQueryDto {
    status?: EmployeeStatus;
    areaId?: string;
    positionId?: string;
    businessUnitId?: string;
    search?: string;
    page?: number;
    limit?: number;
}
