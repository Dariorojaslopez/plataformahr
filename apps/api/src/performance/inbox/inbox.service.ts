import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PerformanceInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, userId: string) {
    const employee = await this.requireEmployee(companyId, userId);
    const items = await this.prisma.performanceNotification.findMany({
      where: { companyId, employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { cycle: { select: { id: true, name: true } } },
    });
    return {
      unreadCount: items.filter((item) => item.readAt == null).length,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        cycleId: item.cycleId,
        cycleName: item.cycle?.name ?? null,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
    };
  }

  async markRead(companyId: string, userId: string, id: string) {
    const employee = await this.requireEmployee(companyId, userId);
    const row = await this.prisma.performanceNotification.findFirst({
      where: { id, companyId, employeeId: employee.id },
    });
    if (!row) throw new NotFoundException('Notificación no encontrada');
    if (!row.readAt) {
      await this.prisma.performanceNotification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    return this.list(companyId, userId);
  }

  private async requireEmployee(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new ForbiddenException(
        'User is not linked to an Employee in this company',
      );
    }
    return employee;
  }
}
