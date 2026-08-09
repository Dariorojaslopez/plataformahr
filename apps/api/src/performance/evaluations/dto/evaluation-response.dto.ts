import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { EVALUATION_COMMENT_MAX_LENGTH } from '../../performance.constants';

export class UpsertEvaluationResponseDto {
  /** Snapshot PerformanceEvaluationScaleLevel id (not catalog). */
  @IsUUID()
  scaleLevelId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(EVALUATION_COMMENT_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) => {
    if (value == null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  comment?: string | null;
}
