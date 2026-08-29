import {
  PerformanceNotificationType,
  type Prisma,
} from '@prisma/client';

export async function createPerformanceNotification(
  db: Prisma.TransactionClient,
  params: {
    companyId: string;
    employeeId: string;
    cycleId?: string | null;
    type: PerformanceNotificationType;
    title: string;
    body: string;
  },
) {
  await db.performanceNotification.create({
    data: {
      companyId: params.companyId,
      employeeId: params.employeeId,
      cycleId: params.cycleId ?? null,
      type: params.type,
      title: params.title,
      body: params.body,
    },
  });
}
