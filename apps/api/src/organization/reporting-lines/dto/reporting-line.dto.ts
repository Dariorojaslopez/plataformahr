import { IsEnum, IsUUID } from 'class-validator';
import { ReportingLineType } from '@prisma/client';

export class CreateReportingLineDto {
  @IsUUID()
  managerEmployeeId!: string;

  @IsEnum(ReportingLineType)
  type!: ReportingLineType;
}
