import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GoalProgressStatus } from '@prisma/client';

export class GoalDefinitionItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsUUID()
  scaleId!: string;

  @IsEnum(GoalProgressStatus)
  progressStatus!: GoalProgressStatus;
}

export class CascadedGoalItemDto extends GoalDefinitionItemDto {
  @IsUUID()
  parentGoalId!: string;

  @IsUUID()
  assigneeEmployeeId!: string;
}

export class GoalDefinitionPdiDto {
  @IsString()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsUUID()
  competencyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actions70?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actions20?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actions10?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  observations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  progressNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  strengths?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  improvements?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent!: number;
}

export class ReviewCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string | null;
}

export class SaveGoalDefinitionDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GoalDefinitionItemDto)
  individualGoals!: GoalDefinitionItemDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CascadedGoalItemDto)
  cascadedGoals!: CascadedGoalItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GoalDefinitionPdiDto)
  pdi?: GoalDefinitionPdiDto | null;
}
