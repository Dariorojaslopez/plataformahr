import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PerformanceCycleStatus,
  PerformanceEvaluationModel,
} from '@prisma/client';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../performance.constants';

export class CycleFollowUpDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class CreatePerformanceCycleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsDateString()
  evaluationStartDate?: string;

  @IsOptional()
  @IsDateString()
  evaluationEndDate?: string;

  @IsOptional()
  @IsDateString()
  goalDefinitionStartDate?: string;

  @IsOptional()
  @IsDateString()
  goalDefinitionEndDate?: string;

  @IsOptional()
  @IsDateString()
  managerEvaluationStartDate?: string;

  @IsOptional()
  @IsDateString()
  managerEvaluationEndDate?: string;

  @IsOptional()
  @IsDateString()
  calibrationStartDate?: string;

  @IsOptional()
  @IsDateString()
  calibrationEndDate?: string;

  @IsOptional()
  @IsDateString()
  closingStartDate?: string;

  @IsOptional()
  @IsDateString()
  closingEndDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CycleFollowUpDto)
  followUps?: CycleFollowUpDto[];

  @IsOptional()
  @IsEnum(PerformanceEvaluationModel)
  evaluationModel?: PerformanceEvaluationModel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  selfEvaluationWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  managerEvaluationWeight?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  peerEvaluationWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  reportEvaluationWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  clientEvaluationWeight?: number | null;

  /** Optional GoalCycle link (09D). Null/omit = competency-only. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  goalCycleId?: string | null;

  @IsOptional()
  @IsBoolean()
  includeCompetencies?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  competencyResultWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  goalsResultWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  organizationalGoalsWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  individualGoalsWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxObjectives?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([100, 120])
  evaluationRange?: number;
}

export class UpdatePerformanceCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  evaluationStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  evaluationEndDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  goalDefinitionStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  goalDefinitionEndDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  managerEvaluationStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  managerEvaluationEndDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  calibrationStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  calibrationEndDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  closingStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  closingEndDate?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CycleFollowUpDto)
  followUps?: CycleFollowUpDto[];

  @IsOptional()
  @IsEnum(PerformanceEvaluationModel)
  evaluationModel?: PerformanceEvaluationModel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  selfEvaluationWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  managerEvaluationWeight?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  peerEvaluationWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  reportEvaluationWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  clientEvaluationWeight?: number | null;

  /** Editable only while DRAFT. Null clears Goals integration. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  goalCycleId?: string | null;

  @IsOptional()
  @IsBoolean()
  includeCompetencies?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  competencyResultWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  goalsResultWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  organizationalGoalsWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(120)
  individualGoalsWeight?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxObjectives?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([100, 120])
  evaluationRange?: number;
}

export class ListPerformanceCyclesQueryDto {
  @IsOptional()
  @IsEnum(PerformanceCycleStatus)
  status?: PerformanceCycleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;
}

export class AddCycleCompetencyDto {
  @IsUUID()
  competencyId!: string;

  @IsUUID()
  scaleId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpdateCycleCompetencyDto {
  @IsOptional()
  @IsUUID()
  scaleId?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
