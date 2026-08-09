import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PerformanceResultStatus } from '@prisma/client';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from '../../performance.constants';

export class ListPerformanceResultsQueryDto {
  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsEnum(PerformanceResultStatus)
  status?: PerformanceResultStatus;

  /** Filter by historical area snapshot (not current Employee.area). */
  @IsOptional()
  @IsUUID()
  areaId?: string;

  /** Filter by historical position snapshot. */
  @IsOptional()
  @IsUUID()
  positionId?: string;

  /** Filter by historical business unit snapshot. */
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  /**
   * Search by current Employee name/email (locator).
   * Org filters use snapshots; search uses live employee display data.
   */
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
