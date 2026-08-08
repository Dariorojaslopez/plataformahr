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
exports.ApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const ats_constants_1 = require("../ats.constants");
const ALLOWED_STAGE_TRANSITIONS = {
    [client_1.ApplicationStage.PENDING_REVIEW]: [
        client_1.ApplicationStage.CONTACTED,
        client_1.ApplicationStage.REJECTED,
        client_1.ApplicationStage.WITHDRAWN,
    ],
    [client_1.ApplicationStage.CONTACTED]: [
        client_1.ApplicationStage.INTERVIEW,
        client_1.ApplicationStage.REJECTED,
        client_1.ApplicationStage.WITHDRAWN,
    ],
    [client_1.ApplicationStage.INTERVIEW]: [
        client_1.ApplicationStage.OFFER,
        client_1.ApplicationStage.REJECTED,
        client_1.ApplicationStage.WITHDRAWN,
    ],
    [client_1.ApplicationStage.OFFER]: [
        client_1.ApplicationStage.HIRED,
        client_1.ApplicationStage.REJECTED,
        client_1.ApplicationStage.WITHDRAWN,
    ],
    [client_1.ApplicationStage.HIRED]: [],
    [client_1.ApplicationStage.REJECTED]: [],
    [client_1.ApplicationStage.WITHDRAWN]: [],
};
const TERMINAL_STAGES = new Set([
    client_1.ApplicationStage.HIRED,
    client_1.ApplicationStage.REJECTED,
    client_1.ApplicationStage.WITHDRAWN,
]);
let ApplicationsService = class ApplicationsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(companyId, query) {
        const page = query.page ?? ats_constants_1.DEFAULT_PAGE;
        const limit = Math.min(query.limit ?? ats_constants_1.DEFAULT_LIMIT, ats_constants_1.MAX_LIMIT);
        const skip = (page - 1) * limit;
        const search = query.search?.trim();
        const where = {
            companyId,
            deletedAt: null,
            ...(query.vacancyId ? { vacancyId: query.vacancyId } : {}),
            ...(query.candidateId ? { candidateId: query.candidateId } : {}),
            ...(query.stage ? { stage: query.stage } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.areaId || query.positionId
                ? {
                    vacancy: {
                        ...(query.areaId ? { areaId: query.areaId } : {}),
                        ...(query.positionId ? { positionId: query.positionId } : {}),
                    },
                }
                : {}),
            ...(search
                ? {
                    candidate: {
                        OR: [
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            {
                                email: {
                                    contains: search.toLowerCase(),
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    },
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.application.findMany({
                where,
                include: {
                    candidate: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            status: true,
                        },
                    },
                    vacancy: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            position: { select: { id: true, name: true } },
                            area: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: { appliedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.application.count({ where }),
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
        const application = await this.prisma.application.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                candidate: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        status: true,
                    },
                },
                vacancy: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        position: { select: { id: true, name: true } },
                        area: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!application) {
            throw new common_1.NotFoundException('Application not found');
        }
        return application;
    }
    async create(companyId, userId, dto) {
        const candidate = await this.prisma.candidate.findFirst({
            where: { id: dto.candidateId, companyId, deletedAt: null },
        });
        if (!candidate) {
            throw new common_1.NotFoundException('Candidate not found');
        }
        const vacancy = await this.prisma.vacancy.findFirst({
            where: { id: dto.vacancyId, companyId, deletedAt: null },
        });
        if (!vacancy) {
            throw new common_1.NotFoundException('Vacancy not found');
        }
        if (vacancy.status !== client_1.VacancyStatus.OPEN) {
            throw new common_1.BadRequestException(`Cannot apply to vacancy with status ${vacancy.status}`);
        }
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const application = await tx.application.create({
                    data: {
                        companyId,
                        candidateId: candidate.id,
                        vacancyId: vacancy.id,
                        stage: client_1.ApplicationStage.PENDING_REVIEW,
                        status: client_1.ApplicationStatus.ACTIVE,
                        appliedAt: new Date(),
                        lastStageChangedAt: new Date(),
                    },
                });
                await tx.applicationStageHistory.create({
                    data: {
                        companyId,
                        applicationId: application.id,
                        fromStage: null,
                        toStage: client_1.ApplicationStage.PENDING_REVIEW,
                        changedByUserId: userId,
                    },
                });
                return application;
            });
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.APPLICATION_CREATED,
                entity: 'Application',
                entityId: created.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: userId } },
                metadata: {
                    applicationId: created.id,
                    candidateId: candidate.id,
                    vacancyId: vacancy.id,
                    toStage: client_1.ApplicationStage.PENDING_REVIEW,
                },
            });
            return created;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Candidate already has an application for this vacancy');
            }
            throw error;
        }
    }
    async move(companyId, userId, id, dto) {
        const updated = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
        SELECT id, "companyId", "candidateId", "vacancyId", stage, status
        FROM applications
        WHERE id = ${id}::uuid
          AND "companyId" = ${companyId}::uuid
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
            const application = locked[0];
            if (!application) {
                throw new common_1.NotFoundException('Application not found');
            }
            if (application.stage === dto.stage) {
                throw new common_1.ConflictException('Application stage changed concurrently; retry with current stage');
            }
            const allowed = ALLOWED_STAGE_TRANSITIONS[application.stage];
            if (!allowed.includes(dto.stage)) {
                throw new common_1.BadRequestException(`Invalid stage transition: ${application.stage} -> ${dto.stage}`);
            }
            const nextStatus = TERMINAL_STAGES.has(dto.stage)
                ? client_1.ApplicationStatus.CLOSED
                : client_1.ApplicationStatus.ACTIVE;
            const transition = await tx.application.updateMany({
                where: {
                    id,
                    companyId,
                    stage: application.stage,
                    deletedAt: null,
                },
                data: {
                    stage: dto.stage,
                    status: nextStatus,
                    lastStageChangedAt: new Date(),
                },
            });
            if (transition.count !== 1) {
                throw new common_1.ConflictException('Application stage changed concurrently; retry with current stage');
            }
            await tx.applicationStageHistory.create({
                data: {
                    companyId,
                    applicationId: id,
                    fromStage: application.stage,
                    toStage: dto.stage,
                    changedByUserId: userId,
                    comment: dto.comment?.trim() || null,
                },
            });
            const current = await tx.application.findFirstOrThrow({
                where: { id, companyId },
            });
            return {
                application: current,
                fromStage: application.stage,
                candidateId: application.candidateId,
                vacancyId: application.vacancyId,
            };
        });
        await this.audit.create({
            action: ats_constants_1.ATS_AUDIT.APPLICATION_STAGE_CHANGED,
            entity: 'Application',
            entityId: id,
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            metadata: {
                applicationId: id,
                candidateId: updated.candidateId,
                vacancyId: updated.vacancyId,
                fromStage: updated.fromStage,
                toStage: dto.stage,
            },
        });
        return updated.application;
    }
    async history(companyId, applicationId) {
        await this.getById(companyId, applicationId);
        return this.prisma.applicationStageHistory.findMany({
            where: { companyId, applicationId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                fromStage: true,
                toStage: true,
                changedByUserId: true,
                comment: true,
                createdAt: true,
            },
        });
    }
    async pipeline(companyId, vacancyId) {
        const vacancy = await this.prisma.vacancy.findFirst({
            where: { id: vacancyId, companyId, deletedAt: null },
            select: { id: true, title: true, status: true },
        });
        if (!vacancy) {
            throw new common_1.NotFoundException('Vacancy not found');
        }
        const applications = await this.prisma.application.findMany({
            where: {
                companyId,
                vacancyId,
                deletedAt: null,
            },
            include: {
                candidate: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { lastStageChangedAt: 'desc' },
        });
        const byStage = new Map();
        for (const stage of ats_constants_1.PIPELINE_STAGES) {
            byStage.set(stage, []);
        }
        for (const application of applications) {
            byStage.get(application.stage)?.push(application);
        }
        return {
            vacancy,
            columns: ats_constants_1.PIPELINE_STAGES.map((stage) => {
                const items = byStage.get(stage) ?? [];
                return {
                    stage,
                    count: items.length,
                    applications: items.map((item) => ({
                        applicationId: item.id,
                        candidateId: item.candidateId,
                        candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`,
                        candidateEmail: item.candidate.email,
                        stage: item.stage,
                        lastStageChangedAt: item.lastStageChangedAt,
                    })),
                };
            }),
        };
    }
};
exports.ApplicationsService = ApplicationsService;
exports.ApplicationsService = ApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map