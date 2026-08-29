import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  PerformanceResultStatus,
  Prisma,
  ReportingLineType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PERFORMANCE_AUDIT } from '../performance.constants';
import type {
  CreateCalibrationSessionDto,
  UpdateCalibrationSessionDto,
} from './dto/calibration.dto';
import {
  DEFAULT_NINE_BOX_CELLS,
  parseScore,
  scoresToNineBoxCell,
  type NineBoxCellConfig,
} from './nine-box';

const EMPLOYEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const SESSION_INCLUDE = {
  cells: { orderBy: [{ row: 'asc' as const }, { col: 'asc' as const }] },
  invitees: {
    include: { employee: { select: EMPLOYEE_SELECT } },
    orderBy: { createdAt: 'asc' as const },
  },
  leaders: {
    include: { employee: { select: EMPLOYEE_SELECT } },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class CalibrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async getConfig(companyId: string) {
    const [company, session] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { showNineBoxOnMyResults: true },
      }),
      this.prisma.calibrationSession.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        include: {
          cells: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        },
      }),
    ]);
    const cells =
      session && session.cells.length === 9
        ? session.cells.map((cell) => this.toCell(cell))
        : DEFAULT_NINE_BOX_CELLS;
    return {
      showNineBoxOnMyResults: company?.showNineBoxOnMyResults !== false,
      sessionId: session?.id ?? null,
      cells,
    };
  }

  async list(companyId: string) {
    const sessions = await this.prisma.calibrationSession.findMany({
      where: { companyId },
      include: SESSION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return { items: sessions.map((session) => this.toSession(session)) };
  }

  async getById(companyId: string, id: string) {
    const session = await this.requireSession(companyId, id);
    return this.toSession(session);
  }

  async create(
    companyId: string,
    userId: string,
    membershipId: string,
    dto: CreateCalibrationSessionDto,
  ) {
    await this.assertAdmin(membershipId);
    const dates = this.parseWindow(dto.opensAt, dto.closesAt);
    const inviteeIds = uniqueIds(dto.inviteeEmployeeIds);
    const leaderIds = uniqueIds(dto.leaderEmployeeIds);
    await this.assertActiveEmployees(companyId, [...inviteeIds, ...leaderIds]);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.calibrationSession.create({
        data: {
          companyId,
          name: dto.name.trim(),
          opensAt: dates.opensAt,
          closesAt: dates.closesAt,
          cells: {
            create: DEFAULT_NINE_BOX_CELLS.map((cell) => ({
              companyId,
              row: cell.row,
              col: cell.col,
              label: cell.label,
              color: cell.color,
            })),
          },
        },
      });
      await this.replacePeople(tx, companyId, created.id, inviteeIds, leaderIds);
      return tx.calibrationSession.findFirstOrThrow({
        where: { id: created.id },
        include: SESSION_INCLUDE,
      });
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CALIBRATION_SESSION_CREATED,
      entity: 'CalibrationSession',
      entityId: session.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return this.toSession(session);
  }

  async update(
    companyId: string,
    userId: string,
    membershipId: string,
    id: string,
    dto: UpdateCalibrationSessionDto,
  ) {
    await this.assertAdmin(membershipId);
    const current = await this.requireSession(companyId, id);
    const nextOpensAt =
      dto.opensAt === undefined
        ? current.opensAt
        : parseOptionalDate(dto.opensAt);
    const nextClosesAt =
      dto.closesAt === undefined
        ? current.closesAt
        : parseOptionalDate(dto.closesAt);
    if (
      nextOpensAt &&
      nextClosesAt &&
      nextOpensAt.getTime() >= nextClosesAt.getTime()
    ) {
      throw new BadRequestException('opensAt must be before closesAt');
    }
    if (dto.cells) this.assertCells(dto.cells);
    const inviteeIds =
      dto.inviteeEmployeeIds === undefined
        ? null
        : uniqueIds(dto.inviteeEmployeeIds);
    const leaderIds =
      dto.leaderEmployeeIds === undefined
        ? null
        : uniqueIds(dto.leaderEmployeeIds);
    await this.assertActiveEmployees(companyId, [
      ...(inviteeIds ?? []),
      ...(leaderIds ?? []),
    ]);

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.calibrationSession.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.opensAt !== undefined ? { opensAt: nextOpensAt } : {}),
          ...(dto.closesAt !== undefined ? { closesAt: nextClosesAt } : {}),
        },
      });
      if (dto.cells) {
        for (const cell of dto.cells) {
          await tx.calibrationNineBoxCell.update({
            where: {
              sessionId_row_col: { sessionId: id, row: cell.row, col: cell.col },
            },
            data: { label: cell.label.trim(), color: cell.color.toLowerCase() },
          });
        }
      }
      if (inviteeIds || leaderIds) {
        await this.replacePeople(
          tx,
          companyId,
          id,
          inviteeIds,
          leaderIds,
        );
      }
      return tx.calibrationSession.findFirstOrThrow({
        where: { id },
        include: SESSION_INCLUDE,
      });
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CALIBRATION_SESSION_UPDATED,
      entity: 'CalibrationSession',
      entityId: session.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
    });
    return this.toSession(session);
  }

  async listPlacements(companyId: string, sessionId: string, cycleId?: string) {
    const session = await this.requireSession(companyId, sessionId);
    const leaderIds = session.leaders.map((row) => row.employeeId);
    if (leaderIds.length === 0) {
      return { items: [], cells: session.cells.map((cell) => this.toCell(cell)) };
    }

    const reports = await this.prisma.employeeReportingLine.findMany({
      where: {
        companyId,
        managerEmployeeId: { in: leaderIds },
        type: ReportingLineType.DIRECT,
        employee: { deletedAt: null, status: EmployeeStatus.ACTIVE },
      },
      select: {
        managerEmployeeId: true,
        employee: { select: EMPLOYEE_SELECT },
      },
    });
    const employeeIds = [...new Set(reports.map((row) => row.employee.id))];
    const results = employeeIds.length
      ? await this.prisma.performanceResult.findMany({
          where: {
            companyId,
            employeeId: { in: employeeIds },
            status: PerformanceResultStatus.RELEASED,
            ...(cycleId ? { cycleId } : {}),
          },
          orderBy: { releasedAt: 'desc' },
          select: {
            employeeId: true,
            overallScore: true,
            competencyScore: true,
            cycleId: true,
            releasedAt: true,
          },
        })
      : [];
    const latest = new Map<string, (typeof results)[number]>();
    for (const row of results) {
      if (!latest.has(row.employeeId)) latest.set(row.employeeId, row);
    }

    const items = reports.map((row) => {
      const result = latest.get(row.employee.id);
      const placement = result
        ? scoresToNineBoxCell({
            overallScore: parseScore(result.overallScore),
            competencyScore: parseScore(result.competencyScore),
          })
        : null;
      return {
        employee: row.employee,
        leaderEmployeeId: row.managerEmployeeId,
        overallScore: result ? result.overallScore.toString() : null,
        competencyScore: result?.competencyScore
          ? result.competencyScore.toString()
          : null,
        cycleId: result?.cycleId ?? null,
        calculatedRow: (placement?.row ?? null) as number | null,
        calculatedCol: (placement?.col ?? null) as number | null,
        row: (placement?.row ?? null) as number | null,
        col: (placement?.col ?? null) as number | null,
        justification: null as string | null,
        moved: false,
      };
    });

    const overrides = await this.prisma.calibrationPlacement.findMany({
      where: {
        companyId,
        sessionId,
        employeeId: { in: employeeIds },
      },
    });
    const byEmployee = new Map(overrides.map((row) => [row.employeeId, row]));
    for (const item of items) {
      const override = byEmployee.get(item.employee.id);
      if (!override) continue;
      item.row = override.row;
      item.col = override.col;
      item.justification = override.justification;
      item.moved = true;
      item.calculatedRow = override.calculatedRow ?? item.calculatedRow;
      item.calculatedCol = override.calculatedCol ?? item.calculatedCol;
    }

    return {
      items,
      cells: session.cells.map((cell) => this.toCell(cell)),
    };
  }

  async savePlacement(
    companyId: string,
    userId: string,
    sessionId: string,
    dto: {
      employeeId: string;
      row: number;
      col: number;
      justification: string;
      cycleId?: string;
    },
  ) {
    const session = await this.requireSession(companyId, sessionId);
    const leaderIds = session.leaders.map((row) => row.employeeId);
    const report = await this.prisma.employeeReportingLine.findFirst({
      where: {
        companyId,
        employeeId: dto.employeeId,
        managerEmployeeId: { in: leaderIds },
        type: ReportingLineType.DIRECT,
      },
    });
    if (!report) {
      throw new ForbiddenException(
        'Solo puedes mover colaboradores de los líderes invitados',
      );
    }
    const justification = dto.justification.trim();
    if (!justification) {
      throw new BadRequestException('La justificación es obligatoria');
    }

    const existing = await this.prisma.performanceResult.findFirst({
      where: {
        companyId,
        employeeId: dto.employeeId,
        status: PerformanceResultStatus.RELEASED,
        ...(dto.cycleId ? { cycleId: dto.cycleId } : {}),
      },
      orderBy: { releasedAt: 'desc' },
      select: { overallScore: true, competencyScore: true },
    });
    const calculated = existing
      ? scoresToNineBoxCell({
          overallScore: parseScore(existing.overallScore),
          competencyScore: parseScore(existing.competencyScore),
        })
      : null;

    const row = await this.prisma.calibrationPlacement.upsert({
      where: {
        sessionId_employeeId: {
          sessionId,
          employeeId: dto.employeeId,
        },
      },
      create: {
        companyId,
        sessionId,
        employeeId: dto.employeeId,
        cycleId: dto.cycleId ?? null,
        row: dto.row,
        col: dto.col,
        calculatedRow: calculated?.row ?? null,
        calculatedCol: calculated?.col ?? null,
        justification,
        movedByUserId: userId,
      },
      update: {
        row: dto.row,
        col: dto.col,
        cycleId: dto.cycleId ?? null,
        calculatedRow: calculated?.row ?? null,
        calculatedCol: calculated?.col ?? null,
        justification,
        movedByUserId: userId,
      },
    });

    await this.audit.create({
      action: PERFORMANCE_AUDIT.CALIBRATION_PLACEMENT_SAVED,
      entity: 'CalibrationPlacement',
      entityId: row.id,
      company: { connect: { id: companyId } },
      user: { connect: { id: userId } },
      metadata: { sessionId, employeeId: dto.employeeId },
    });
    return this.listPlacements(companyId, sessionId, dto.cycleId);
  }

  private async requireSession(companyId: string, id: string) {
    const session = await this.prisma.calibrationSession.findFirst({
      where: { id, companyId },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException('Calibration session not found');
    return session;
  }

  private async assertAdmin(membershipId: string) {
    const ok = await this.rbac.membershipHasRoleCode(
      membershipId,
      'CLIENT_ADMIN',
    );
    if (!ok) {
      throw new ForbiddenException(
        'Only CLIENT_ADMIN can modify calibration sessions',
      );
    }
  }

  private parseWindow(
    opensAt?: string | null,
    closesAt?: string | null,
    skip = false,
  ): { opensAt?: Date | null; closesAt?: Date | null } {
    if (skip) return {};
    const open = opensAt === undefined ? undefined : parseOptionalDate(opensAt);
    const close =
      closesAt === undefined ? undefined : parseOptionalDate(closesAt);
    if (open && close && open.getTime() >= close.getTime()) {
      throw new BadRequestException('opensAt must be before closesAt');
    }
    return { opensAt: open, closesAt: close };
  }

  private assertCells(cells: NineBoxCellConfig[]) {
    const keys = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
    if (keys.size !== 9) {
      throw new BadRequestException('cells must cover every 9Box position');
    }
  }

  private async assertActiveEmployees(companyId: string, ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.prisma.employee.findMany({
      where: {
        companyId,
        id: { in: ids },
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException(
        'One or more employees are invalid for this company',
      );
    }
  }

  private async replacePeople(
    tx: Prisma.TransactionClient,
    companyId: string,
    sessionId: string,
    inviteeIds: string[] | null,
    leaderIds: string[] | null,
  ) {
    if (inviteeIds) {
      await tx.calibrationSessionInvitee.deleteMany({ where: { sessionId } });
      if (inviteeIds.length > 0) {
        await tx.calibrationSessionInvitee.createMany({
          data: inviteeIds.map((employeeId) => ({
            companyId,
            sessionId,
            employeeId,
          })),
        });
      }
    }
    if (leaderIds) {
      await tx.calibrationSessionLeader.deleteMany({ where: { sessionId } });
      if (leaderIds.length > 0) {
        await tx.calibrationSessionLeader.createMany({
          data: leaderIds.map((employeeId) => ({
            companyId,
            sessionId,
            employeeId,
          })),
        });
      }
    }
  }

  private toCell(cell: {
    row: number;
    col: number;
    label: string;
    color: string;
  }): NineBoxCellConfig {
    return {
      row: cell.row,
      col: cell.col,
      label: cell.label,
      color: cell.color,
    };
  }

  private toSession(session: {
    id: string;
    companyId: string;
    name: string;
    opensAt: Date | null;
    closesAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    cells: Array<{ row: number; col: number; label: string; color: string }>;
    invitees: Array<{ employee: { id: string; firstName: string; lastName: string; email: string } }>;
    leaders: Array<{ employee: { id: string; firstName: string; lastName: string; email: string } }>;
  }) {
    return {
      id: session.id,
      companyId: session.companyId,
      name: session.name,
      opensAt: session.opensAt?.toISOString() ?? null,
      closesAt: session.closesAt?.toISOString() ?? null,
      cells: session.cells.map((cell) => this.toCell(cell)),
      invitees: session.invitees.map((row) => row.employee),
      leaders: session.leaders.map((row) => row.employee),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}

function uniqueIds(ids?: string[]): string[] {
  return [...new Set(ids ?? [])];
}

function parseOptionalDate(value: string | null): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return date;
}
