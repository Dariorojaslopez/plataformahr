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
exports.CandidatesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../core/audit/audit.service");
const organization_helpers_1 = require("../../organization/organization.helpers");
const prisma_service_1 = require("../../prisma/prisma.service");
const ats_constants_1 = require("../ats.constants");
let CandidatesService = class CandidatesService {
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
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        {
                            email: { contains: search.toLowerCase(), mode: 'insensitive' },
                        },
                        {
                            documentNumber: {
                                contains: search,
                                mode: 'insensitive',
                            },
                        },
                    ],
                }
                : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.candidate.findMany({
                where,
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
                skip,
                take: limit,
            }),
            this.prisma.candidate.count({ where }),
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
        const candidate = await this.prisma.candidate.findFirst({
            where: { id, companyId, deletedAt: null },
        });
        if (!candidate) {
            throw new common_1.NotFoundException('Candidate not found');
        }
        return candidate;
    }
    async create(companyId, userId, dto) {
        const email = (0, organization_helpers_1.normalizeEmail)(dto.email);
        const documentNumber = (0, organization_helpers_1.emptyToNull)(dto.documentNumber) ?? null;
        try {
            const created = await this.prisma.candidate.create({
                data: {
                    companyId,
                    firstName: dto.firstName.trim(),
                    lastName: dto.lastName.trim(),
                    email,
                    phone: (0, organization_helpers_1.emptyToNull)(dto.phone) ?? null,
                    documentType: (0, organization_helpers_1.emptyToNull)(dto.documentType) ?? null,
                    documentNumber,
                    country: (0, organization_helpers_1.emptyToNull)(dto.country) ?? null,
                    state: (0, organization_helpers_1.emptyToNull)(dto.state) ?? null,
                    city: (0, organization_helpers_1.emptyToNull)(dto.city) ?? null,
                    source: (0, organization_helpers_1.emptyToNull)(dto.source) ?? null,
                    status: client_1.CandidateStatus.ACTIVE,
                },
            });
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.CANDIDATE_CREATED,
                entity: 'Candidate',
                entityId: created.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: userId } },
                metadata: { candidateId: created.id },
            });
            return created;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A candidate with the same email or document already exists in this company');
            }
            throw error;
        }
    }
    async update(companyId, userId, id, dto) {
        await this.getById(companyId, id);
        if (dto.status === client_1.CandidateStatus.HIRED) {
            throw new common_1.BadRequestException('Candidate status HIRED is reserved for the future hiring workflow');
        }
        try {
            const updated = await this.prisma.candidate.update({
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
                    ...(dto.phone !== undefined ? { phone: (0, organization_helpers_1.emptyToNull)(dto.phone) } : {}),
                    ...(dto.documentType !== undefined
                        ? { documentType: (0, organization_helpers_1.emptyToNull)(dto.documentType) }
                        : {}),
                    ...(dto.documentNumber !== undefined
                        ? { documentNumber: (0, organization_helpers_1.emptyToNull)(dto.documentNumber) }
                        : {}),
                    ...(dto.country !== undefined
                        ? { country: (0, organization_helpers_1.emptyToNull)(dto.country) }
                        : {}),
                    ...(dto.state !== undefined ? { state: (0, organization_helpers_1.emptyToNull)(dto.state) } : {}),
                    ...(dto.city !== undefined ? { city: (0, organization_helpers_1.emptyToNull)(dto.city) } : {}),
                    ...(dto.source !== undefined
                        ? { source: (0, organization_helpers_1.emptyToNull)(dto.source) }
                        : {}),
                    ...(dto.status !== undefined ? { status: dto.status } : {}),
                },
            });
            await this.audit.create({
                action: ats_constants_1.ATS_AUDIT.CANDIDATE_UPDATED,
                entity: 'Candidate',
                entityId: updated.id,
                company: { connect: { id: companyId } },
                user: { connect: { id: userId } },
                metadata: { candidateId: updated.id },
            });
            return updated;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('A candidate with the same email or document already exists in this company');
            }
            throw error;
        }
    }
};
exports.CandidatesService = CandidatesService;
exports.CandidatesService = CandidatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], CandidatesService);
//# sourceMappingURL=candidates.service.js.map