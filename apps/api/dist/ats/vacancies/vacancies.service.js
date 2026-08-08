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
exports.VacanciesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const ats_constants_1 = require("../ats.constants");
const ALLOWED_TRANSITIONS = {
    [client_1.VacancyStatus.OPEN]: [
        client_1.VacancyStatus.PAUSED,
        client_1.VacancyStatus.CLOSED,
        client_1.VacancyStatus.CANCELLED,
    ],
    [client_1.VacancyStatus.PAUSED]: [
        client_1.VacancyStatus.OPEN,
        client_1.VacancyStatus.CLOSED,
        client_1.VacancyStatus.CANCELLED,
    ],
    [client_1.VacancyStatus.CLOSED]: [],
    [client_1.VacancyStatus.CANCELLED]: [],
};
let VacanciesService = class VacanciesService {
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
            ...(query.status ? { status: query.status } : {}),
            ...(search
                ? {
                    title: { contains: search, mode: 'insensitive' },
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.vacancy.findMany({
                where,
                include: {
                    position: { select: { id: true, name: true, headcount: true } },
                    area: { select: { id: true, name: true } },
                },
                orderBy: { openedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.vacancy.count({ where }),
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
        const vacancy = await this.prisma.vacancy.findFirst({
            where: { id, companyId, deletedAt: null },
            include: {
                position: true,
                area: true,
                vacancyRequest: {
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        requestedHeadcount: true,
                    },
                },
            },
        });
        if (!vacancy) {
            throw new common_1.NotFoundException('Vacancy not found');
        }
        return vacancy;
    }
    async update(companyId, userId, id, dto) {
        const existing = await this.prisma.vacancy.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Vacancy not found');
        }
        if (dto.status && dto.status !== existing.status) {
            const allowed = ALLOWED_TRANSITIONS[existing.status];
            if (!allowed.includes(dto.status)) {
                throw new common_1.BadRequestException(`Invalid vacancy status transition: ${existing.status} -> ${dto.status}`);
            }
        }
        const updated = await this.prisma.vacancy.update({
            where: { id },
            data: {
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.status !== undefined
                    ? {
                        status: dto.status,
                        closedAt: dto.status === client_1.VacancyStatus.CLOSED ||
                            dto.status === client_1.VacancyStatus.CANCELLED
                            ? new Date()
                            : dto.status === client_1.VacancyStatus.OPEN ||
                                dto.status === client_1.VacancyStatus.PAUSED
                                ? null
                                : existing.closedAt,
                    }
                    : {}),
            },
        });
        if (dto.status && dto.status !== existing.status) {
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.VACANCY_STATUS_CHANGED,
                entity: 'Vacancy',
                entityId: updated.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: userId } },
                metadata: {
                    id: updated.id,
                    from: existing.status,
                    to: updated.status,
                },
            });
        }
        return updated;
    }
};
exports.VacanciesService = VacanciesService;
exports.VacanciesService = VacanciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], VacanciesService);
//# sourceMappingURL=vacancies.service.js.map