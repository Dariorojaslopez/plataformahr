import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCompanyPerformanceSettingsDto {
  @IsOptional()
  @IsBoolean()
  goalsCascadeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  showNineBoxOnMyResults?: boolean;
}
