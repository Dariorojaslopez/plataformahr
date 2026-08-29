import { Injectable } from '@nestjs/common';
import { OrganizationEntityStatus } from '@prisma/client';
import { withDuplicateCompanyCodeConflict } from '../../common/prisma/duplicate-company-code';
import { nextSequentialCode } from '../../common/sequential-code';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { emptyToNull } from '../organization.helpers';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import { PositionCustomFieldsService } from '../position-custom-fields/position-custom-fields.service';
import type { SerializedPosition } from '../position-custom-fields/position-custom-fields.serialize';
import type { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
    private readonly customFields: PositionCustomFieldsService,
  ) {}

  list(companyId: string): Promise<SerializedPosition[]> {
    return this.customFields.listSerializedPositions(companyId);
  }

  getById(companyId: string, id: string): Promise<SerializedPosition> {
    return this.customFields.getSerializedPosition(companyId, id);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePositionDto,
  ): Promise<SerializedPosition> {
    await this.integrity.requireArea(companyId, dto.areaId);
    if (dto.jobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
    }

    const code =
      emptyToNull(dto.code) ??
      nextSequentialCode(
        (
          await this.prisma.position.findMany({
            where: { companyId },
            select: { code: true },
          })
        ).map((row) => row.code),
      );
    const created = await withDuplicateCompanyCodeConflict(code, () =>
      this.prisma.$transaction(async (tx) => {
        const position = await tx.position.create({
          data: {
            companyId,
            areaId: dto.areaId,
            jobLevelId: dto.jobLevelId ?? null,
            name: dto.name.trim(),
            code,
            mission: emptyToNull(dto.mission) ?? null,
            responsibilities: emptyToNull(dto.responsibilities) ?? null,
            requiredExperience: emptyToNull(dto.requiredExperience) ?? null,
            requiredEducation: emptyToNull(dto.requiredEducation) ?? null,
            headcount: dto.headcount ?? 1,
            status: dto.status ?? OrganizationEntityStatus.ACTIVE,
          },
        });
        await this.customFields.writePositionValues(
          tx,
          companyId,
          position.id,
          dto.customFields,
          'create',
        );
        return position;
      }),
    );

    await this.audit.create({
      action: ORG_AUDIT.POSITION_CREATED,
      entity: 'Position',
      entityId: created.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id: created.id,
        customFieldDefinitionIds: (dto.customFields ?? []).map(
          (field) => field.definitionId,
        ),
      },
    });

    return this.customFields.getSerializedPosition(companyId, created.id);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdatePositionDto,
  ): Promise<SerializedPosition> {
    await this.integrity.requirePosition(companyId, id);

    if (dto.areaId) {
      await this.integrity.requireArea(companyId, dto.areaId);
    }
    if (dto.jobLevelId) {
      await this.integrity.requireJobLevel(companyId, dto.jobLevelId);
    }

    await withDuplicateCompanyCodeConflict(dto.code, () =>
      this.prisma.$transaction(async (tx) => {
        await tx.position.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.areaId !== undefined ? { areaId: dto.areaId } : {}),
            ...(dto.jobLevelId !== undefined
              ? { jobLevelId: dto.jobLevelId }
              : {}),
            ...(dto.code !== undefined ? { code: emptyToNull(dto.code) } : {}),
            ...(dto.mission !== undefined
              ? { mission: emptyToNull(dto.mission) }
              : {}),
            ...(dto.responsibilities !== undefined
              ? { responsibilities: emptyToNull(dto.responsibilities) }
              : {}),
            ...(dto.requiredExperience !== undefined
              ? { requiredExperience: emptyToNull(dto.requiredExperience) }
              : {}),
            ...(dto.requiredEducation !== undefined
              ? { requiredEducation: emptyToNull(dto.requiredEducation) }
              : {}),
            ...(dto.headcount !== undefined
              ? { headcount: dto.headcount }
              : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
        });
        const customFieldsChanged = await this.customFields.writePositionValues(
          tx,
          companyId,
          id,
          dto.customFields,
          'update',
        );
        return customFieldsChanged;
      }),
    );

    await this.audit.create({
      action: ORG_AUDIT.POSITION_UPDATED,
      entity: 'Position',
      entityId: id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id,
        customFieldsUpdated: dto.customFields !== undefined,
      },
    });

    if (dto.customFields !== undefined) {
      await this.audit.create({
        action: ORG_AUDIT.POSITION_CUSTOM_FIELDS_UPDATED,
        entity: 'Position',
        entityId: id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: {
          id,
          definitionIds: dto.customFields.map((field) => field.definitionId),
        },
      });
    }

    return this.customFields.getSerializedPosition(companyId, id);
  }
}
