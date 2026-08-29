import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MAX_VACANCY_EVALUATORS } from '../../ats.constants';

export class PositionOccupantStepDto {
  @IsUUID()
  positionId!: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;
}

export class ReplacePositionOccupantStepsDto {
  @IsArray()
  @ArrayMaxSize(MAX_VACANCY_EVALUATORS)
  @ValidateNested({ each: true })
  @Type(() => PositionOccupantStepDto)
  steps!: PositionOccupantStepDto[];
}
