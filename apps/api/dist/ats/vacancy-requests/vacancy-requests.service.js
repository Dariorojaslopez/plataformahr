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
exports.VacancyRequestsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const rbac_service_1 = require("../../core/rbac/rbac.service");
const organization_integrity_service_1 = require("../../organization/organization-integrity.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const ats_constants_1 = require("../ats.constants");
let VacancyRequestsService = class VacancyRequestsService {
    prisma;
    audit;
    integrity;
    rbac;
    constructor(prisma, audit, integrity, rbac) {
        this.prisma = prisma;
        this.audit = audit;
        this.integrity = integrity;
        this.rbac = rbac;
    }
    async list(companyId, query) {
        const page = query.page ?? ats_constants_1.DEFAULT_PAGE;
        const limit = Math.min(query.limit ?? ats_constants_1.DEFAULT_LIMIT, ats_constants_1.MAX_LIMIT);
        const skip = (page - 1) * limit;
        const search = query.search?.trim();
        const where = {
            companyId,
            deletedAt: null,
            ...(query.status ? { status: query.status } : {}),
            ...(query.type ? { type: query.type } : {}),
            ...(query.requestedByEmployeeId
                ? { requestedByEmployeeId: query.requestedByEmployeeId }
                : {}),
            ...(search
                ? {
                    OR: [
                        {
                            requestedPositionName: {
                                contains: search,
                                mode: 'insensitive',
                            },
                        },
                        {
                            existingPosition: {
                                name: { contains: search, mode: 'insensitive' },
                            },
                        },
                    ],
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.vacancyRequest.findMany({
                where,
                include: {
                    existingPosition: { select: { id: true, name: true } },
                    requestedArea: { select: { id: true, name: true } },
                    requestedByEmployee: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    approvals: { orderBy: { sequence: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.vacancyRequest.count({ where }),
        ]);
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        };
    }
    async getById(companyId, id) {
        const request = await this.prisma.vacancyRequest.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                existingPosition: true,
                requestedArea: true,
                requestedJobLevel: true,
                requestedByEmployee: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                approvals: { orderBy: { sequence: 'asc' } },
                vacancy: true,
            },
        });
        if (!request) {
            throw new common_1.NotFoundException('Vacancy request not found');
        }
        return request;
    }
    async create(tenant, dto) {
        const requestedByEmployeeId = await this.resolveRequesterEmployeeId(tenant, dto.requestedByEmployeeId);
        await this.validateRequestShape(tenant.companyId, dto);
        const created = await this.prisma.vacancyRequest.create({
            data: this.toCreateData(tenant.companyId, requestedByEmployeeId, dto),
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_CREATED,
            entity: 'VacancyRequest',
            entityId: created.id,
            company: { connect: { id: tenant.companyId } },
            user: { connect: { id: tenant.userId } },
            metadata: { id: created.id, status: created.status, type: created.type },
        });
        return created;
    }
    async update(tenant, id, dto) {
        const existing = await this.requireDraft(tenant.companyId, id);
        const mergedType = dto.type ?? existing.type;
        const shape = {
            type: mergedType,
            existingPositionId: dto.existingPositionId !== undefined
                ? dto.existingPositionId
                : existing.existingPositionId,
            requestedPositionName: dto.requestedPositionName !== undefined
                ? dto.requestedPositionName
                : existing.requestedPositionName,
            requestedAreaId: dto.requestedAreaId !== undefined
                ? dto.requestedAreaId
                : existing.requestedAreaId,
            requestedJobLevelId: dto.requestedJobLevelId !== undefined
                ? dto.requestedJobLevelId
                : existing.requestedJobLevelId,
            requestedHeadcount: dto.requestedHeadcount ?? existing.requestedHeadcount,
            justification: dto.justification ?? existing.justification,
            generalManagerApprovalRequired: dto.generalManagerApprovalRequired ??
                existing.generalManagerApprovalRequired,
        };
        if (dto.requestedByEmployeeId) {
            await this.resolveRequesterEmployeeId(tenant, dto.requestedByEmployeeId);
        }
        await this.validateRequestShape(tenant.companyId, shape);
        const updated = await this.prisma.vacancyRequest.update({
            where: { id },
            data: {
                ...(dto.type !== undefined ? { type: dto.type } : {}),
                ...(dto.requestedByEmployeeId !== undefined
                    ? { requestedByEmployeeId: dto.requestedByEmployeeId }
                    : {}),
                ...(dto.requestedHeadcount !== undefined
                    ? { requestedHeadcount: dto.requestedHeadcount }
                    : {}),
                ...(dto.justification !== undefined
                    ? { justification: dto.justification.trim() }
                    : {}),
                ...(dto.generalManagerApprovalRequired !== undefined
                    ? {
                        generalManagerApprovalRequired: dto.generalManagerApprovalRequired,
                    }
                    : {}),
                ...this.shapeFieldsForType(mergedType, shape),
            },
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_UPDATED,
            entity: 'VacancyRequest',
            entityId: updated.id,
            company: { connect: { id: tenant.companyId } },
            user: { connect: { id: tenant.userId } },
            metadata: { id: updated.id, status: updated.status },
        });
        return updated;
    }
    async submit(tenant, id) {
        const request = await this.requireDraft(tenant.companyId, id);
        await this.validateRequestShape(tenant.companyId, {
            type: request.type,
            existingPositionId: request.existingPositionId,
            requestedPositionName: request.requestedPositionName,
            requestedAreaId: request.requestedAreaId,
            requestedJobLevelId: request.requestedJobLevelId,
            requestedHeadcount: request.requestedHeadcount,
            justification: request.justification,
            generalManagerApprovalRequired: request.generalManagerApprovalRequired,
        });
        const directManager = await this.prisma.employeeReportingLine.findFirst({
            where: {
                companyId: tenant.companyId,
                employeeId: request.requestedByEmployeeId,
                type: client_1.ReportingLineType.DIRECT,
            },
        });
        if (!directManager) {
            throw new common_1.BadRequestException('Cannot submit: requester has no DIRECT manager reporting line');
        }
        const approvalsData = [
            {
                companyId: tenant.companyId,
                vacancyRequestId: id,
                step: client_1.VacancyApprovalStep.DIRECT_MANAGER,
                sequence: 1,
                approverEmployeeId: directManager.managerEmployeeId,
                status: client_1.ApprovalStatus.PENDING,
            },
            {
                companyId: tenant.companyId,
                vacancyRequestId: id,
                step: client_1.VacancyApprovalStep.HR,
                sequence: 2,
                requiredRoleCode: ats_constants_1.TEMP_APPROVER_ROLE_CODE,
                status: client_1.ApprovalStatus.PENDING,
            },
        ];
        if (request.generalManagerApprovalRequired) {
            approvalsData.push({
                companyId: tenant.companyId,
                vacancyRequestId: id,
                step: client_1.VacancyApprovalStep.GENERAL_MANAGER,
                sequence: 3,
                requiredRoleCode: ats_constants_1.TEMP_APPROVER_ROLE_CODE,
                status: client_1.ApprovalStatus.PENDING,
            });
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const transition = await tx.vacancyRequest.updateMany({
                where: {
                    id,
                    companyId: tenant.companyId,
                    status: client_1.VacancyRequestStatus.DRAFT,
                    deletedAt: null,
                },
                data: {
                    status: client_1.VacancyRequestStatus.PENDING_APPROVAL,
                    submittedAt: new Date(),
                },
            });
            if (transition.count !== 1) {
                throw new common_1.ConflictException('Vacancy request is not in DRAFT status');
            }
            await tx.vacancyApproval.createMany({ data: approvalsData });
            return tx.vacancyRequest.findFirstOrThrow({
                where: { id, companyId: tenant.companyId },
                include: { approvals: { orderBy: { sequence: 'asc' } } },
            });
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_SUBMITTED,
            entity: 'VacancyRequest',
            entityId: id,
            company: { connect: { id: tenant.companyId } },
            user: { connect: { id: tenant.userId } },
            metadata: { id, status: client_1.VacancyRequestStatus.PENDING_APPROVAL },
        });
        return result;
    }
    async approve(tenant, id, dto) {
        return this.decide(tenant, id, 'approve', dto.comment);
    }
    async reject(tenant, id, dto) {
        return this.decide(tenant, id, 'reject', dto.comment);
    }
    async decide(tenant, id, decision, comment) {
        const request = await this.prisma.vacancyRequest.findFirst({
            where: {
                id,
                companyId: tenant.companyId,
                deletedAt: null,
                status: client_1.VacancyRequestStatus.PENDING_APPROVAL,
            },
            include: { approvals: { orderBy: { sequence: 'asc' } } },
        });
        if (!request) {
            throw new common_1.NotFoundException('Vacancy request not found or not pending');
        }
        const current = request.approvals.find((step) => step.status === client_1.ApprovalStatus.PENDING);
        if (!current) {
            throw new common_1.ConflictException('No pending approval step');
        }
        await this.assertCanDecideStep(tenant, current);
        if (decision === 'reject') {
            const rejected = await this.prisma.$transaction(async (tx) => {
                const stepUpdate = await tx.vacancyApproval.updateMany({
                    where: {
                        id: current.id,
                        companyId: tenant.companyId,
                        status: client_1.ApprovalStatus.PENDING,
                    },
                    data: {
                        status: client_1.ApprovalStatus.REJECTED,
                        decidedByUserId: tenant.userId,
                        decidedAt: new Date(),
                        comment: comment?.trim() ?? null,
                    },
                });
                if (stepUpdate.count !== 1) {
                    throw new common_1.ConflictException('Approval step already decided');
                }
                const requestUpdate = await tx.vacancyRequest.updateMany({
                    where: {
                        id,
                        companyId: tenant.companyId,
                        status: client_1.VacancyRequestStatus.PENDING_APPROVAL,
                    },
                    data: {
                        status: client_1.VacancyRequestStatus.REJECTED,
                        rejectedAt: new Date(),
                    },
                });
                if (requestUpdate.count !== 1) {
                    throw new common_1.ConflictException('Vacancy request is no longer pending');
                }
                return tx.vacancyRequest.findFirstOrThrow({
                    where: { id, companyId: tenant.companyId },
                    include: { approvals: { orderBy: { sequence: 'asc' } } },
                });
            });
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_REJECTED,
                entity: 'VacancyRequest',
                entityId: id,
                company: { connect: { id: tenant.companyId } },
                user: { connect: { id: tenant.userId } },
                metadata: {
                    id,
                    step: current.step,
                    status: client_1.VacancyRequestStatus.REJECTED,
                },
            });
            return rejected;
        }
        const approved = await this.prisma.$transaction(async (tx) => {
            const stepUpdate = await tx.vacancyApproval.updateMany({
                where: {
                    id: current.id,
                    companyId: tenant.companyId,
                    status: client_1.ApprovalStatus.PENDING,
                },
                data: {
                    status: client_1.ApprovalStatus.APPROVED,
                    decidedByUserId: tenant.userId,
                    decidedAt: new Date(),
                    comment: comment?.trim() ?? null,
                },
            });
            if (stepUpdate.count !== 1) {
                throw new common_1.ConflictException('Approval step already decided');
            }
            const remaining = await tx.vacancyApproval.count({
                where: {
                    vacancyRequestId: id,
                    companyId: tenant.companyId,
                    status: client_1.ApprovalStatus.PENDING,
                },
            });
            if (remaining > 0) {
                return tx.vacancyRequest.findFirstOrThrow({
                    where: { id, companyId: tenant.companyId },
                    include: {
                        approvals: { orderBy: { sequence: 'asc' } },
                        vacancy: true,
                    },
                });
            }
            const finalize = await tx.vacancyRequest.updateMany({
                where: {
                    id,
                    companyId: tenant.companyId,
                    status: client_1.VacancyRequestStatus.PENDING_APPROVAL,
                },
                data: {
                    status: client_1.VacancyRequestStatus.APPROVED,
                    approvedAt: new Date(),
                },
            });
            if (finalize.count !== 1) {
                throw new common_1.ConflictException('Vacancy request already finalized');
            }
            await this.createVacancyFromApprovedRequest(tx, tenant.companyId, id);
            return tx.vacancyRequest.findFirstOrThrow({
                where: { id, companyId: tenant.companyId },
                include: {
                    approvals: { orderBy: { sequence: 'asc' } },
                    vacancy: true,
                },
            });
        });
        const fullyApproved = approved.status === client_1.VacancyRequestStatus.APPROVED;
        await this.audit.create({
            action: fullyApproved
                ? ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_APPROVED
                : ats_constants_1.ATS_AUDIT.VACANCY_REQUEST_APPROVED_STEP,
            entity: 'VacancyRequest',
            entityId: id,
            company: { connect: { id: tenant.companyId } },
            user: { connect: { id: tenant.userId } },
            metadata: {
                id,
                step: current.step,
                status: approved.status,
            },
        });
        if (fullyApproved && approved.vacancy) {
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.VACANCY_CREATED,
                entity: 'Vacancy',
                entityId: approved.vacancy.id,
                company: { connect: { id: tenant.companyId } },
                user: { connect: { id: tenant.userId } },
                metadata: {
                    id: approved.vacancy.id,
                    vacancyRequestId: id,
                },
            });
        }
        return approved;
    }
    async createVacancyFromApprovedRequest(tx, companyId, requestId) {
        const request = await tx.vacancyRequest.findFirstOrThrow({
            where: { id: requestId, companyId },
        });
        let positionId;
        let areaId;
        let title;
        if (request.type === client_1.VacancyRequestType.EXISTING_POSITION) {
            if (!request.existingPositionId) {
                throw new common_1.BadRequestException('Missing existing position');
            }
            const position = await tx.position.findFirst({
                where: {
                    id: request.existingPositionId,
                    companyId,
                    deletedAt: null,
                },
            });
            if (!position) {
                throw new common_1.NotFoundException('Existing position not found');
            }
            await tx.position.update({
                where: { id: position.id },
                data: {
                    headcount: { increment: request.requestedHeadcount },
                },
            });
            positionId = position.id;
            areaId = position.areaId;
            title = position.name;
        }
        else {
            if (!request.requestedPositionName || !request.requestedAreaId) {
                throw new common_1.BadRequestException('Missing new position fields');
            }
            const area = await tx.area.findFirst({
                where: {
                    id: request.requestedAreaId,
                    companyId,
                    deletedAt: null,
                },
            });
            if (!area) {
                throw new common_1.NotFoundException('Requested area not found');
            }
            if (request.requestedJobLevelId) {
                const jobLevel = await tx.jobLevel.findFirst({
                    where: {
                        id: request.requestedJobLevelId,
                        companyId,
                        deletedAt: null,
                    },
                });
                if (!jobLevel) {
                    throw new common_1.NotFoundException('Requested job level not found');
                }
            }
            try {
                const createdPosition = await tx.position.create({
                    data: {
                        companyId,
                        name: request.requestedPositionName.trim(),
                        areaId: request.requestedAreaId,
                        jobLevelId: request.requestedJobLevelId,
                        headcount: request.requestedHeadcount,
                        status: client_1.OrganizationEntityStatus.ACTIVE,
                    },
                });
                positionId = createdPosition.id;
                areaId = createdPosition.areaId;
                title = createdPosition.name;
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2002') {
                    throw new common_1.ConflictException('A position with the same name already exists in this company');
                }
                throw error;
            }
        }
        try {
            await tx.vacancy.create({
                data: {
                    companyId,
                    vacancyRequestId: request.id,
                    positionId,
                    areaId,
                    title,
                    headcount: request.requestedHeadcount,
                    filledCount: 0,
                    status: client_1.VacancyStatus.OPEN,
                    openedAt: new Date(),
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Vacancy already exists for this request');
            }
            throw error;
        }
    }
    async assertCanDecideStep(tenant, step) {
        if (step.step === client_1.VacancyApprovalStep.DIRECT_MANAGER) {
            if (!step.approverEmployeeId) {
                throw new common_1.ForbiddenException('Direct manager approver is not configured');
            }
            const employee = await this.prisma.employee.findFirst({
                where: {
                    id: step.approverEmployeeId,
                    companyId: tenant.companyId,
                    userId: tenant.userId,
                    deletedAt: null,
                },
            });
            if (!employee) {
                throw new common_1.ForbiddenException('Only the assigned direct manager can approve this step');
            }
            return;
        }
        if (!step.requiredRoleCode) {
            throw new common_1.ForbiddenException('Required role is not configured');
        }
        const hasRole = await this.rbac.membershipHasRoleCode(tenant.membershipId, step.requiredRoleCode);
        if (!hasRole) {
            throw new common_1.ForbiddenException(`Membership must have role ${step.requiredRoleCode} for this step`);
        }
    }
    async resolveRequesterEmployeeId(tenant, requestedByEmployeeId) {
        const roleCodes = await this.rbac.getRoleCodesForMembership(tenant.membershipId);
        const canProxy = ats_constants_1.PROXY_REQUESTER_ROLE_CODES.some((code) => roleCodes.has(code));
        if (requestedByEmployeeId) {
            await this.integrity.requireEmployee(tenant.companyId, requestedByEmployeeId);
            if (!canProxy) {
                const own = await this.prisma.employee.findFirst({
                    where: {
                        id: requestedByEmployeeId,
                        companyId: tenant.companyId,
                        userId: tenant.userId,
                        deletedAt: null,
                    },
                });
                if (!own) {
                    throw new common_1.ForbiddenException('Cannot create vacancy requests on behalf of another employee');
                }
            }
            return requestedByEmployeeId;
        }
        const ownEmployee = await this.prisma.employee.findFirst({
            where: {
                companyId: tenant.companyId,
                userId: tenant.userId,
                deletedAt: null,
            },
        });
        if (!ownEmployee) {
            throw new common_1.BadRequestException('requestedByEmployeeId is required when the user has no linked employee');
        }
        return ownEmployee.id;
    }
    async validateRequestShape(companyId, dto) {
        if (dto.requestedHeadcount < 1) {
            throw new common_1.BadRequestException('requestedHeadcount must be >= 1');
        }
        if (!dto.justification?.trim()) {
            throw new common_1.BadRequestException('justification is required');
        }
        if (dto.type === client_1.VacancyRequestType.EXISTING_POSITION) {
            if (!dto.existingPositionId) {
                throw new common_1.BadRequestException('existingPositionId is required for EXISTING_POSITION');
            }
            if (dto.requestedPositionName ||
                dto.requestedAreaId ||
                dto.requestedJobLevelId) {
                throw new common_1.BadRequestException('NEW_POSITION fields must be null for EXISTING_POSITION');
            }
            await this.integrity.requirePosition(companyId, dto.existingPositionId);
            return;
        }
        if (dto.existingPositionId) {
            throw new common_1.BadRequestException('existingPositionId must be null for NEW_POSITION');
        }
        if (!dto.requestedPositionName?.trim()) {
            throw new common_1.BadRequestException('requestedPositionName is required for NEW_POSITION');
        }
        if (!dto.requestedAreaId) {
            throw new common_1.BadRequestException('requestedAreaId is required for NEW_POSITION');
        }
        await this.integrity.requireArea(companyId, dto.requestedAreaId);
        if (dto.requestedJobLevelId) {
            await this.integrity.requireJobLevel(companyId, dto.requestedJobLevelId);
        }
    }
    toCreateData(companyId, requestedByEmployeeId, dto) {
        const base = {
            company: { connect: { id: companyId } },
            requestedByEmployee: { connect: { id: requestedByEmployeeId } },
            type: dto.type,
            requestedHeadcount: dto.requestedHeadcount,
            justification: dto.justification.trim(),
            generalManagerApprovalRequired: dto.generalManagerApprovalRequired ?? false,
            status: client_1.VacancyRequestStatus.DRAFT,
        };
        if (dto.type === client_1.VacancyRequestType.EXISTING_POSITION) {
            return {
                ...base,
                existingPosition: { connect: { id: dto.existingPositionId } },
            };
        }
        return {
            ...base,
            requestedPositionName: dto.requestedPositionName.trim(),
            requestedArea: { connect: { id: dto.requestedAreaId } },
            ...(dto.requestedJobLevelId
                ? { requestedJobLevel: { connect: { id: dto.requestedJobLevelId } } }
                : {}),
        };
    }
    shapeFieldsForType(type, shape) {
        if (type === client_1.VacancyRequestType.EXISTING_POSITION) {
            return {
                existingPositionId: shape.existingPositionId ?? null,
                requestedPositionName: null,
                requestedAreaId: null,
                requestedJobLevelId: null,
            };
        }
        return {
            existingPositionId: null,
            requestedPositionName: shape.requestedPositionName?.trim() ?? null,
            requestedAreaId: shape.requestedAreaId ?? null,
            requestedJobLevelId: shape.requestedJobLevelId ?? null,
        };
    }
    async requireDraft(companyId, id) {
        const request = await this.prisma.vacancyRequest.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!request) {
            throw new common_1.NotFoundException('Vacancy request not found');
        }
        if (request.status !== client_1.VacancyRequestStatus.DRAFT) {
            throw new common_1.BadRequestException('Only DRAFT vacancy requests can be edited');
        }
        return request;
    }
};
exports.VacancyRequestsService = VacancyRequestsService;
exports.VacancyRequestsService = VacancyRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        organization_integrity_service_1.OrganizationIntegrityService,
        rbac_service_1.RbacService])
], VacancyRequestsService);
//# sourceMappingURL=vacancy-requests.service.js.map