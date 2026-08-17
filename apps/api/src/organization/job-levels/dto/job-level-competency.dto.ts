import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceJobLevelCompetenciesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  competencyIds!: string[];
}
