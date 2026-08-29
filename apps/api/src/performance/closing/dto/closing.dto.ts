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

export class SaveClosingSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  collaboratorObservations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  leaderObservations?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  pdiProgressPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pdiProgressNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pdiStrengths?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pdiImprovements?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
