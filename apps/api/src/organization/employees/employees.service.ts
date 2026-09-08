import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  MembershipStatus,
  Prisma,
  ReportingLineType,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PasswordHashingService } from '../../auth/password-hashing.service';
import { AuditService } from '../../core/audit/audit.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  ORG_AUDIT,
} from '../organization.constants';
import { emptyToNull, normalizeEmail } from '../organization.helpers';
import { OrganizationIntegrityService } from '../organization-integrity.service';
import { PositionCustomFieldsService } from '../position-custom-fields/position-custom-fields.service';
import {
  POSITION_CUSTOM_FIELD_VALUE_INCLUDE,
  serializeEmployee,
  type SerializedEmployee,
} from '../position-custom-fields/position-custom-fields.serialize';
import type {
  CreateEmployeeDto,
  EmployeeAccessRoleCode,
  ListEmployeesQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly integrity: OrganizationIntegrityService,
    private readonly customFields: PositionCustomFieldsService,
    private readonly passwords: PasswordHashingService,
    private readonly mail: MailService,
  ) {}

  async list(companyId: string, query: ListEmployeesQueryDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
        include: {
          customFieldValues: { include: POSITION_CUSTOM_FIELD_VALUE_INCLUDE },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: rows.map(serializeEmployee),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  getById(companyId: string, id: string): Promise<SerializedEmployee> {
    return this.customFields.getSerializedEmployee(companyId, id);
  }

  async getOrganizationProfile(companyId: string, id: string) {
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
      throw new NotFoundException('Employee not found');
    }

    const directManager =
      employee.reportingTo.find(
        (line) => line.type === ReportingLineType.DIRECT,
      )?.manager ?? null;
    const indirectManagers = employee.reportingTo
      .filter((line) => line.type === ReportingLineType.INDIRECT)
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

  async create(
    companyId: string,
    userId: string,
    dto: CreateEmployeeDto,
  ): Promise<SerializedEmployee> {
    await this.validateRelations(companyId, dto);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            companyId,
            userId: dto.userId ?? null,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: normalizeEmail(dto.email),
            phone: emptyToNull(dto.phone) ?? null,
            documentType: emptyToNull(dto.documentType) ?? null,
            documentNumber: emptyToNull(dto.documentNumber) ?? null,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            country: emptyToNull(dto.country) ?? null,
            state: emptyToNull(dto.state) ?? null,
            city: emptyToNull(dto.city) ?? null,
            maritalStatus: emptyToNull(dto.maritalStatus) ?? null,
            childrenCount: dto.childrenCount ?? null,
            housingType: emptyToNull(dto.housingType) ?? null,
            emergencyContactName: emptyToNull(dto.emergencyContactName) ?? null,
            emergencyContactPhone:
              emptyToNull(dto.emergencyContactPhone) ?? null,
            businessUnitId: dto.businessUnitId ?? null,
            areaId: dto.areaId,
            positionId: dto.positionId,
            status: dto.status ?? EmployeeStatus.ACTIVE,
            hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
            terminationDate: dto.terminationDate
              ? new Date(dto.terminationDate)
              : null,
          },
        });
        await this.customFields.writeEmployeeValues(
          tx,
          companyId,
          employee.id,
          dto.customFields,
          'create',
        );
        return employee;
      });

      await this.audit.create({
        action: ORG_AUDIT.EMPLOYEE_CREATED,
        entity: 'Employee',
        entityId: created.id,
        company: { connect: { id: companyId } },
        user: { connect: { id: userId } },
        metadata: { id: created.id },
      });

      return this.customFields.getSerializedEmployee(companyId, created.id);
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error);
    }
  }

  async update(
    companyId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<SerializedEmployee> {
    const existing = await this.integrity.requireEmployee(companyId, id);
    await this.validateRelations(companyId, dto, existing);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id },
          data: {
            ...(dto.firstName !== undefined
              ? { firstName: dto.firstName.trim() }
              : {}),
            ...(dto.lastName !== undefined
              ? { lastName: dto.lastName.trim() }
              : {}),
            ...(dto.email !== undefined
              ? { email: normalizeEmail(dto.email) }
              : {}),
            ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
            ...(dto.phone !== undefined
              ? { phone: emptyToNull(dto.phone) }
              : {}),
            ...(dto.documentType !== undefined
              ? { documentType: emptyToNull(dto.documentType) }
              : {}),
            ...(dto.documentNumber !== undefined
              ? { documentNumber: emptyToNull(dto.documentNumber) }
              : {}),
            ...(dto.birthDate !== undefined
              ? {
                  birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
                }
              : {}),
            ...(dto.country !== undefined
              ? { country: emptyToNull(dto.country) }
              : {}),
            ...(dto.state !== undefined
              ? { state: emptyToNull(dto.state) }
              : {}),
            ...(dto.city !== undefined ? { city: emptyToNull(dto.city) } : {}),
            ...(dto.maritalStatus !== undefined
              ? { maritalStatus: emptyToNull(dto.maritalStatus) }
              : {}),
            ...(dto.childrenCount !== undefined
              ? { childrenCount: dto.childrenCount }
              : {}),
            ...(dto.housingType !== undefined
              ? { housingType: emptyToNull(dto.housingType) }
              : {}),
            ...(dto.emergencyContactName !== undefined
              ? {
                  emergencyContactName: emptyToNull(dto.emergencyContactName),
                }
              : {}),
            ...(dto.emergencyContactPhone !== undefined
              ? {
                  emergencyContactPhone: emptyToNull(dto.emergencyContactPhone),
                }
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
        await this.customFields.writeEmployeeValues(
          tx,
          companyId,
          id,
          dto.customFields,
          'update',
        );
      });

      await this.audit.create({
        action: ORG_AUDIT.EMPLOYEE_UPDATED,
        entity: 'Employee',
        entityId: id,
        company: { connect: { id: companyId } },
        user: { connect: { id: actorUserId } },
        metadata: {
          id,
          customFieldsUpdated: dto.customFields !== undefined,
        },
      });

      if (dto.customFields !== undefined) {
        await this.audit.create({
          action: ORG_AUDIT.EMPLOYEE_CUSTOM_FIELDS_UPDATED,
          entity: 'Employee',
          entityId: id,
          company: { connect: { id: companyId } },
          user: { connect: { id: actorUserId } },
          metadata: {
            id,
            definitionIds: dto.customFields.map((field) => field.definitionId),
          },
        });
      }

      return this.customFields.getSerializedEmployee(companyId, id);
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error);
    }
  }

  async removeMany(
    companyId: string,
    actorUserId: string,
    ids: string[],
  ): Promise<{ deleted: number }> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Selecciona al menos un colaborador.');
    }
    const employees = await this.prisma.employee.findMany({
      where: { companyId, id: { in: uniqueIds }, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (employees.length !== uniqueIds.length) {
      throw new NotFoundException('Uno o más colaboradores no existen.');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({
        where: { companyId, id: { in: uniqueIds }, deletedAt: null },
        data: { deletedAt: now, userId: null },
      });
      const userIds = employees
        .map((item) => item.userId)
        .filter((id): id is string => Boolean(id));
      if (userIds.length > 0) {
        await tx.companyMembership.updateMany({
          where: { companyId, userId: { in: userIds } },
          data: { status: MembershipStatus.INACTIVE },
        });
      }
    });

    await this.audit.create({
      action: ORG_AUDIT.EMPLOYEE_DELETED,
      entity: 'Employee',
      entityId: uniqueIds[0],
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: { ids: uniqueIds, count: uniqueIds.length },
    });
    return { deleted: uniqueIds.length };
  }

  async issueAccess(
    companyId: string,
    actorUserId: string,
    employeeId: string,
    roleCode: EmployeeAccessRoleCode = 'LEADER',
  ): Promise<{
    email: string;
    temporaryPassword: string;
    passwordEmailed: boolean;
    roleCode: EmployeeAccessRoleCode;
  }> {
    const employee = await this.integrity.requireEmployee(companyId, employeeId);
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        'Solo se puede dar acceso a un colaborador activo.',
      );
    }
    const role = await this.prisma.role.findUnique({
      where: { scope_code: { scope: RoleScope.COMPANY, code: roleCode } },
    });
    if (!role) {
      throw new ConflictException('El rol solicitado no está provisionado.');
    }

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const email = normalizeEmail(employee.email);

    const user = await this.prisma.$transaction(async (tx) => {
      let existing = employee.userId
        ? await tx.user.findFirst({
            where: { id: employee.userId, deletedAt: null },
          })
        : await tx.user.findFirst({
            where: { email, deletedAt: null },
          });

      if (existing) {
        const other = await tx.employee.findFirst({
          where: {
            companyId,
            userId: existing.id,
            deletedAt: null,
            NOT: { id: employee.id },
          },
        });
        if (other) {
          throw new ConflictException(
            'Ese email ya tiene acceso ligado a otro colaborador.',
          );
        }
        existing = await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            mustChangePassword: true,
            status: UserStatus.ACTIVE,
            firstName: employee.firstName,
            lastName: employee.lastName,
          },
        });
      } else {
        existing = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: employee.firstName,
            lastName: employee.lastName,
            status: UserStatus.ACTIVE,
            mustChangePassword: true,
          },
        });
      }

      await tx.employee.update({
        where: { id: employee.id },
        data: { userId: existing.id },
      });

      const membership = await tx.companyMembership.upsert({
        where: {
          userId_companyId: { userId: existing.id, companyId },
        },
        create: {
          userId: existing.id,
          companyId,
          status: MembershipStatus.ACTIVE,
        },
        update: { status: MembershipStatus.ACTIVE },
      });
      await tx.membershipRole.deleteMany({
        where: { membershipId: membership.id },
      });
      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
      });
      await tx.userSession.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return existing;
    });

    const firstName = employee.firstName.trim() || 'hola';
    const mailResult = await this.mail.sendText({
      to: user.email,
      subject: 'Acceso a Talentgrowthos',
      text: [
        `Hola ${firstName},`,
        '',
        'Te crearon un acceso a Talentgrowthos.',
        '',
        `Email: ${user.email}`,
        `Contraseña temporal: ${temporaryPassword}`,
        '',
        'Inicia sesión y cámbiala de inmediato.',
        '',
        '— Talentgrowthos',
      ].join('\n'),
      html: [
        `<p>Hola ${escapeHtml(firstName)},</p>`,
        '<p>Te crearon un acceso a <strong>Talentgrowthos</strong>.</p>',
        `<p>Email: <code>${escapeHtml(user.email)}</code></p>`,
        '<p>Contraseña temporal:</p>',
        `<p style="font-size:18px;font-weight:700;letter-spacing:0.04em"><code>${escapeHtml(temporaryPassword)}</code></p>`,
        '<p>Inicia sesión y cámbiala de inmediato.</p>',
        '<p>— Talentgrowthos</p>',
      ].join(''),
    });

    await this.audit.create({
      action: ORG_AUDIT.EMPLOYEE_ACCESS_ISSUED,
      entity: 'Employee',
      entityId: employee.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: actorUserId } },
      metadata: {
        employeeId: employee.id,
        targetUserId: user.id,
        roleCode,
        passwordEmailed: mailResult.status === 'SENT',
      },
    });

    return {
      email: user.email,
      temporaryPassword,
      passwordEmailed: mailResult.status === 'SENT',
      roleCode,
    };
  }

  private rethrowUniqueConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Employee unique constraint violated');
    }
    throw error;
  }

  private async validateRelations(
    companyId: string,
    dto: Partial<CreateEmployeeDto | UpdateEmployeeDto>,
    existing?: { areaId: string; positionId: string },
  ): Promise<void> {
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

    const areaId = dto.areaId ?? existing?.areaId;
    const positionId = dto.positionId ?? existing?.positionId;
    if (areaId && positionId) {
      const position = await this.integrity.requirePosition(
        companyId,
        positionId,
      );
      if (position.areaId !== areaId) {
        throw new BadRequestException(
          'El cargo no pertenece al área seleccionada. Elige un cargo de esa área.',
        );
      }
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
