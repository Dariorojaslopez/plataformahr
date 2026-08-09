import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../goals.constants';

export class CreateCompletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requestComment?: string | null;
}

export class ApproveCompletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewComment?: string | null;
}

export class RejectCompletionDto {
  @IsString()
  @MaxLength(2000)
  reviewComment!: string;
}

export class ListCompletionRequestsQueryDto {
  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

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
