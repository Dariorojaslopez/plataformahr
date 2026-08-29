import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VacancyApproverType } from '@prisma/client';
import { MAX_VACANCY_APPROVAL_STEPS } from '../../ats.constants';

export class VacancyApprovalWorkflowStepInputDto {
  @IsEnum(VacancyApproverType)
  approverType!: VacancyApproverType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;

  @ValidateIf(
    (o: VacancyApprovalWorkflowStepInputDto) =>
      o.approverType === VacancyApproverType.SPECIFIC_EMPLOYEE ||
      (o.approverType === VacancyApproverType.POSITION &&
        Boolean(o.specificEmployeeId)),
  )
  @IsUUID()
  specificEmployeeId?: string | null;

  @ValidateIf(
    (o: VacancyApprovalWorkflowStepInputDto) =>
      o.approverType === VacancyApproverType.POSITION,
  )
  @IsUUID()
  positionId?: string | null;

  @ValidateIf(
    (o: VacancyApprovalWorkflowStepInputDto) =>
      o.approverType === VacancyApproverType.ROLE,
  )
  @IsString()
  @MaxLength(80)
  requiredRoleCode?: string | null;
}

export class UpdateVacancyApprovalWorkflowDto {
  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMaxSize(MAX_VACANCY_APPROVAL_STEPS)
  @ValidateNested({ each: true })
  @Type(() => VacancyApprovalWorkflowStepInputDto)
  steps!: VacancyApprovalWorkflowStepInputDto[];
}
