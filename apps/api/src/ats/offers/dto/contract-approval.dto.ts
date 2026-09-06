import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideContractApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
