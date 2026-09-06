import { PreHireCheckStatus, PreHireDocumentKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdatePreHireDto {
  @IsOptional()
  @IsEnum(PreHireCheckStatus)
  securityStudyStatus?: PreHireCheckStatus;

  @IsOptional()
  @IsEnum(PreHireCheckStatus)
  medicalExamStatus?: PreHireCheckStatus;
}

export class UploadPreHireDocumentDto {
  @IsEnum(PreHireDocumentKind)
  kind!: PreHireDocumentKind;
}
