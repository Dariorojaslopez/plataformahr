"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const organization_constants_1 = require("../organization.constants");
const organization_helpers_1 = require("../organization.helpers");
const organization_integrity_service_1 = require("../organization-integrity.service");
let EmployeesService = class EmployeesService {
    prisma;
    audit;
    integrity;
    constructor(prisma, audit, integrity) {
        this.prisma = prisma;
        this.audit = audit;
        this.integrity = integrity;
    }
    async list(companyId, query) {
        const page = query.page ?? organization_constants_1.DEFAULT_PAGE;
        const limit = Math.min(query.limit ?? organization_constants_1.DEFAULT_LIMIT, organization_constants_1.MAX_LIMIT);
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            deletedAt: null,
            ...(query.status ? { status: query.status } : {}),
            ...(query.areaId ? { areaId: query.areaId } : {}),
            ...(query.positionId ? { positionId: query.positionId } : {}),
            ...(query.businessUnitId ? { businessUnitId: query.businessUnitId } : {}),
            ...(query.search
                ? {
                    OR: [
                        {
                            firstName: {
                                contains: query.search.trim(),
                                mode: 'insensitive',
                            },
                        },
                        {
                            lastName: {
                                contains: query.search.trim(),
                                mode: 'insensitive',
                            },
                        },
                        {
                            email: {
                                contains: query.search.trim().toLowerCase(),
                                mode: 'insensitive',
                            },
                        },
                    ],
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.employee.findMany({
                where,
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
                skip,
                take: limit,
            }),
            this.prisma.employee.count({ where }),
        ]);
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        };
    }
    getById(companyId, id) {
        return this.integrity.requireEmployee(companyId, id);
    }
    async getOrganizationProfile(companyId, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                businessUnit: true,
                area: true,
                position: {
                    include: { jobLevel: true },
                },
                reportingTo: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        if (!employee) {
            throw new common_1.NotFoundException('Employee not found');
        }
        const directManager = employee.reportingTo.find((line) => line.type === client_1.ReportingLineType.DIRECT)?.manager ?? null;
        const indirectManagers = employee.reportingTo
            .filter((line) => line.type === client_1.ReportingLineType.INDIRECT)
            .map((line) => line.manager);
        return {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            status: employee.status,
            hireDate: employee.hireDate,
            businessUnit: employee.businessUnit
                ? {
                    id: employee.businessUnit.id,
                    name: employee.businessUnit.name,
                    code: employee.businessUnit.code,
                }
                : null,
            area: {
                id: employee.area.id,
                name: employee.area.name,
                code: employee.area.code,
            },
            position: {
                id: employee.position.id,
                name: employee.position.name,
                code: employee.position.code,
            },
            jobLevel: employee.position.jobLevel
                ? {
                    id: employee.position.jobLevel.id,
                    name: employee.position.jobLevel.name,
                    rank: employee.position.jobLevel.rank,
                }
                : null,
            directManager,
            indirectManagers,
        };
    }
    async create(companyId, userId, dto) {
        await this.validateRelations(companyId, dto);
        try {
            const created = await this.prisma.employee.create({
                data: {
                    companyId,
                    userId: dto.userId ?? null,
                    firstName: dto.firstName.trim(),
                    lastName: dto.lastName.trim(),
                    email: (0, organization_helpers_1.normalizeEmail)(dto.email),
                    phone: (0, organization_helpers_1.emptyToNull)(dto.phone) ?? null,
                    birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
                    country: (0, organization_helpers_1.emptyToNull)(dto.country) ?? null,
                    state: (0, organization_helpers_1.emptyToNull)(dto.state) ?? null,
                    city: (0, organization_helpers_1.emptyToNull)(dto.city) ?? null,
                    maritalStatus: (0, organization_helpers_1.emptyToNull)(dto.maritalStatus) ?? null,
                    childrenCount: dto.childrenCount ?? null,
                    housingType: (0, organization_helpers_1.emptyToNull)(dto.housingType) ?? null,
                    emergencyContactName: (0, organization_helpers_1.emptyToNull)(dto.emergencyContactName) ?? null,
                    emergencyContactPhone: (0, organization_helpers_1.emptyToNull)(dto.emergencyContactPhone) ?? null,
                    businessUnitId: dto.businessUnitId ?? null,
                    areaId: dto.areaId,
                    positionId: dto.positionId,
                    status: dto.status ?? client_1.EmployeeStatus.ACTIVE,
                    hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
                    terminationDate: dto.terminationDate
                        ? new Date(dto.terminationDate)
                        : null,
                },
            });
            await this.audit.create({
                action: organization_constants_1.ORG_AUDIT.EMPLOYEE_CREATED,
                entity: 'Employee',
                entityId: created.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: userId } },
                metadata: { id: created.id },
            });
            return created;
        }
        catch (error) {
            this.rethrowUniqueConflict(error);
        }
    }
    async update(companyId, actorUserId, id, dto) {
        await this.integrity.requireEmployee(companyId, id);
        await this.validateRelations(companyId, dto);
        try {
            const updated = await this.prisma.employee.update({
                where: { id },
                data: {
                    ...(dto.firstName !== undefined
                        ? { firstName: dto.firstName.trim() }
                        : {}),
                    ...(dto.lastName !== undefined
                        ? { lastName: dto.lastName.trim() }
                        : {}),
                    ...(dto.email !== undefined
                        ? { email: (0, organization_helpers_1.normalizeEmail)(dto.email) }
                        : {}),
                    ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
                    ...(dto.phone !== undefined ? { phone: (0, organization_helpers_1.emptyToNull)(dto.phone) } : {}),
                    ...(dto.birthDate !== undefined
                        ? {
                            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
                        }
                        : {}),
                    ...(dto.country !== undefined
                        ? { country: (0, organization_helpers_1.emptyToNull)(dto.country) }
                        : {}),
                    ...(dto.state !== undefined ? { state: (0, organization_helpers_1.emptyToNull)(dto.state) } : {}),
                    ...(dto.city !== undefined ? { city: (0, organization_helpers_1.emptyToNull)(dto.city) } : {}),
                    ...(dto.maritalStatus !== undefined
                        ? { maritalStatus: (0, organization_helpers_1.emptyToNull)(dto.maritalStatus) }
                        : {}),
                    ...(dto.childrenCount !== undefined
                        ? { childrenCount: dto.childrenCount }
                        : {}),
                    ...(dto.housingType !== undefined
                        ? { housingType: (0, organization_helpers_1.emptyToNull)(dto.housingType) }
                        : {}),
                    ...(dto.emergencyContactName !== undefined
                        ? { emergencyContactName: (0, organization_helpers_1.emptyToNull)(dto.emergencyContactName) }
                        : {}),
                    ...(dto.emergencyContactPhone !== undefined
                        ? { emergencyContactPhone: (0, organization_helpers_1.emptyToNull)(dto.emergencyContactPhone) }
                        : {}),
                    ...(dto.businessUnitId !== undefined
                        ? { businessUnitId: dto.businessUnitId }
                        : {}),
                    ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
                    ...(dto.positionId !== undefined
                        ? { positionId: dto.positionId }
                        : {}),
                    ...(dto.status !== undefined ? { status: dto.status } : {}),
                    ...(dto.hireDate !== undefined
                        ? { hireDate: dto.hireDate ? new Date(dto.hireDate) : null }
                        : {}),
                    ...(dto.terminationDate !== undefined
                        ? {
                            terminationDate: dto.terminationDate
                                ? new Date(dto.terminationDate)
                                : null,
                        }
                        : {}),
                },
            });
            await this.audit.create({
                action: organization_constants_1.ORG_AUDIT.EMPLOYEE_UPDATED,
                entity: 'Employee',
                entityId: updated.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: actorUserId } },
                metadata: { id: updated.id },
            });
            return updated;
        }
        catch (error) {
            this.rethrowUniqueConflict(error);
        }
    }
    rethrowUniqueConflict(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            throw new common_1.ConflictException('Employee unique constraint violated');
        }
        throw error;
    }
    async validateRelations(companyId, dto) {
        if (dto.areaId) {
            await this.integrity.requireArea(companyId, dto.areaId);
        }
        if (dto.positionId) {
            await this.integrity.requirePosition(companyId, dto.positionId);
        }
        if (dto.businessUnitId) {
            await this.integrity.requireBusinessUnit(companyId, dto.businessUnitId);
        }
        if (dto.userId) {
            await this.integrity.assertUserMembership(companyId, dto.userId);
        }
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        organization_integrity_service_1.OrganizationIntegrityService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map