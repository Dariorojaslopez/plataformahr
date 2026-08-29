import { IsUUID } from 'class-validator';

export class ListPositionOccupantsQueryDto {
  @IsUUID()
  positionId!: string;
}
