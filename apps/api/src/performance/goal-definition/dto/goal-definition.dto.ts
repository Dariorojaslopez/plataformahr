import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GoalProgressStatus } from '@prisma/client';

function emptyToNull({ value }: { value: unknown }) {
  if (value === '' || value === undefined) return null;
  return value;
}

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

  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return null;
    return Number(value);
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  targetValue?: number | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID()
  targetScaleLevelId?: string | null;
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
