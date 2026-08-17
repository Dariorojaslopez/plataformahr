import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PositionCustomFieldType,
  Prisma,
  type PositionCustomFieldDefinition,
  type PositionCustomFieldOption,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ORG_AUDIT } from '../organization.constants';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import type {
  CreatePositionCustomFieldDefinitionDto,
  PositionCustomFieldValueInputDto,
  UpdatePositionCustomFieldDefinitionDto,
  UpsertPositionCustomFieldOptionDto,
} from './dto/position-custom-field.dto';
import {
  POSITION_CUSTOM_FIELD_VALUE_INCLUDE,
  serializePosition,
  type SerializedPosition,
} from './position-custom-fields.serialize';
import {
  allowedSelectOptionIds,
  assertCustomFieldKey,
  MAX_CUSTOM_FIELDS,
  parseCustomFieldValue,
  valueColumnsFromParsed,
} from './position-custom-fields.validation';

const DEFINITION_INCLUDE = {
  options: {
    orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }],
  },
  _count: { select: { values: true } },
};

type DefinitionWithOptions = PositionCustomFieldDefinition & {
  options: PositionCustomFieldOption[];
  _count: { values: number };
};

@Injectable()
export class PositionCustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
  ) {}

  listDefinitions(companyId: string) {
    return this.prisma.positionCustomFieldDefinition.findMany({
      where: { companyId },
      include: DEFINITION_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async createDefinition(
    companyId: string,
    userId: string,
    dto: CreatePositionCustomFieldDefinitionDto,
  ) {
    const key = assertCustomFieldKey(dto.key);
    this.assertTypeOptions(dto.type, dto.options?.length ?? 0);

    const count = await this.prisma.positionCustomFieldDefinition.count({
      where: { companyId },
    });
    if (count >= MAX_CUSTOM_FIELDS) {
      throw new BadRequestException('Maximum number of custom fields reached');
    }

    try {
      const created = await this.prisma.positionCustomFieldDefinition.create({
        data: {
          companyId,
          key,
          label: dto.label.trim(),
          type: dto.type,
          required: dto.required ?? false,
          active: dto.active ?? true,
          sortOrder: dto.sortOrder ?? count,
          options:
            dto.type === PositionCustomFieldType.SELECT
              ? {
                  create: (dto.options ?? []).map((option, index) => ({
                    companyId,
                    label: option.label.trim(),
                    sortOrder: option.sortOrder ?? index,
                    active: true,
                  })),
                }
              : undefined,
        },
        include: DEFINITION_INCLUDE,
      });

      await this.audit.create({
        action: ORG_AUDIT.POSITION_CUSTOM_FIELD_DEFINITION_CREATED,
        entity: 'PositionCustomFieldDefinition',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: created.id, key: created.key, type: created.type },
      });

      return created;
    } catch (error) {
      this.rethrowDuplicateKey(error);
    }
  }

  async updateDefinition(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdatePositionCustomFieldDefinitionDto,
  ) {
    const current = await this.requireDefinition(companyId, id);
    const nextType = dto.type ?? current.type;
    const hasValues = current._count.values > 0;

    if (dto.type && dto.type !== current.type && hasValues) {
      throw new ConflictException(
        'Cannot change type of a custom field that already has values',
      );
    }

    if (dto.options !== undefined) {
      if (nextType !== PositionCustomFieldType.SELECT) {
        throw new BadRequestException(
          'Options are only valid for SELECT fields',
        );
      }
      this.assertIncomingOptions(current.options, dto.options);
    } else if (nextType === PositionCustomFieldType.SELECT) {
      const wouldHaveActive = current.options.some((option) => option.active);
      if (!wouldHaveActive) {
        throw new BadRequestException(
          'SELECT fields require at least one option',
        );
      }
    } else {
      this.assertTypeOptions(nextType, 0);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.options && nextType === PositionCustomFieldType.SELECT) {
        await this.syncOptions(tx, companyId, current, dto.options);
      } else if (
        dto.type &&
        dto.type !== PositionCustomFieldType.SELECT &&
        current.type === PositionCustomFieldType.SELECT
      ) {
        await tx.positionCustomFieldOption.updateMany({
          where: { definitionId: current.id, companyId },
          data: { active: false },
        });
      }

      return tx.positionCustomFieldDefinition.update({
        where: { id: current.id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.required !== undefined ? { required: dto.required } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
        include: DEFINITION_INCLUDE,
      });
    });

    await this.audit.create({
      action: ORG_AUDIT.POSITION_CUSTOM_FIELD_DEFINITION_UPDATED,
      entity: 'PositionCustomFieldDefinition',
      entityId: updated.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: {
        id: updated.id,
        key: updated.key,
        label: updated.label,
        required: updated.required,
        active: updated.active,
        type: updated.type,
      },
    });

    return updated;
  }

  async writePositionValues(
    tx: Prisma.TransactionClient,
    companyId: string,
    positionId: string,
    inputs: PositionCustomFieldValueInputDto[] | undefined,
    mode: 'create' | 'update',
  ): Promise<boolean> {
    if (mode === 'update' && inputs === undefined) {
      return false;
    }

    const submitted = inputs ?? [];
    const submittedIds = submitted.map((item) => item.definitionId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('Duplicate custom field definitionId');
    }

    const definitions = await tx.positionCustomFieldDefinition.findMany({
      where: { companyId },
      include: { options: true },
    });
    const defById = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    const submittedByDef = new Map(
      submitted.map((item) => [item.definitionId, item] as const),
    );

    for (const item of submitted) {
      const definition = defById.get(item.definitionId);
      if (!definition) {
        throw new NotFoundException('Custom field definition not found');
      }
      if (!definition.active) {
        throw new BadRequestException('Custom field is not active');
      }
    }

    const existingValues = await tx.positionCustomFieldValue.findMany({
      where: { companyId, positionId },
    });
    const existingByDef = new Map(
      existingValues.map((value) => [value.definitionId, value]),
    );

    let changed = false;
    for (const definition of definitions.filter((item) => item.active)) {
      const item = submittedByDef.get(definition.id);
      const parsed = parseCustomFieldValue(
        definition.type,
        item?.value,
        definition.required,
        allowedSelectOptionIds(
          definition.options,
          existingByDef.get(definition.id)?.optionId,
        ),
      );
      const existing = existingByDef.get(definition.id);
      if (parsed.kind === 'empty') {
        if (existing) {
          await tx.positionCustomFieldValue.delete({
            where: { id: existing.id },
          });
          changed = true;
        }
        continue;
      }

      const columns = valueColumnsFromParsed(parsed);
      if (existing) {
        await tx.positionCustomFieldValue.update({
          where: { id: existing.id },
          data: columns,
        });
      } else {
        await tx.positionCustomFieldValue.create({
          data: {
            companyId,
            positionId,
            definitionId: definition.id,
            ...columns,
          },
        });
      }
      changed = true;
    }

    return changed;
  }

  async getSerializedPosition(
    companyId: string,
    positionId: string,
  ): Promise<SerializedPosition> {
    await this.integrity.requirePosition(companyId, positionId);
    const row = await this.prisma.position.findFirst({
      where: { id: positionId, companyId, deletedAt: null },
      include: {
        customFieldValues: { include: POSITION_CUSTOM_FIELD_VALUE_INCLUDE },
      },
    });
    if (!row) {
      throw new NotFoundException('Position not found');
    }
    return serializePosition(row);
  }

  async listSerializedPositions(
    companyId: string,
  ): Promise<SerializedPosition[]> {
    const rows = await this.prisma.position.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        customFieldValues: { include: POSITION_CUSTOM_FIELD_VALUE_INCLUDE },
      },
    });
    return rows.map(serializePosition);
  }

  private async requireDefinition(
    companyId: string,
    id: string,
  ): Promise<DefinitionWithOptions> {
    const definition =
      await this.prisma.positionCustomFieldDefinition.findFirst({
        where: { id, companyId },
        include: DEFINITION_INCLUDE,
      });
    if (!definition) {
      throw new NotFoundException('Custom field definition not found');
    }
    return definition;
  }

  private assertTypeOptions(
    type: PositionCustomFieldType,
    optionCount: number,
  ) {
    if (type === PositionCustomFieldType.SELECT) {
      if (optionCount < 1) {
        throw new BadRequestException(
          'SELECT fields require at least one option',
        );
      }
      return;
    }
    if (optionCount > 0) {
      throw new BadRequestException('Options are only valid for SELECT fields');
    }
  }

  private assertIncomingOptions(
    existing: PositionCustomFieldOption[],
    incoming: UpsertPositionCustomFieldOptionDto[],
  ) {
    const existingById = new Map(existing.map((option) => [option.id, option]));
    for (const option of incoming) {
      if (option.id && !existingById.has(option.id)) {
        throw new NotFoundException('Custom field option not found');
      }
    }
    const remainingActive = incoming.filter(
      (option) => option.active !== false,
    );
    if (remainingActive.length < 1) {
      throw new BadRequestException(
        'SELECT fields require at least one active option',
      );
    }
  }

  private async syncOptions(
    tx: Prisma.TransactionClient,
    companyId: string,
    current: DefinitionWithOptions,
    incoming: UpsertPositionCustomFieldOptionDto[],
  ) {
    const incomingIds = new Set(
      incoming
        .filter((option) => option.id)
        .map((option) => option.id as string),
    );

    for (const option of current.options) {
      if (!incomingIds.has(option.id) && option.active) {
        await tx.positionCustomFieldOption.update({
          where: { id: option.id },
          data: { active: false },
        });
      }
    }

    for (const [index, option] of incoming.entries()) {
      if (option.id) {
        await tx.positionCustomFieldOption.update({
          where: { id: option.id },
          data: {
            label: option.label.trim(),
            sortOrder: option.sortOrder ?? index,
            ...(option.active !== undefined ? { active: option.active } : {}),
          },
        });
        continue;
      }
      await tx.positionCustomFieldOption.create({
        data: {
          companyId,
          definitionId: current.id,
          label: option.label.trim(),
          sortOrder: option.sortOrder ?? index,
          active: option.active ?? true,
        },
      });
    }
  }

  private rethrowDuplicateKey(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A custom field with this key already exists',
      );
    }
    throw error;
  }
}
