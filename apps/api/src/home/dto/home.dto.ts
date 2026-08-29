import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateHomeProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  maritalStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  childrenCount?: number | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  housingType?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  emergencyContactPhone?: string;
}

export class InternalJobApplicationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  documentNumber?: string;
}

export type HomeProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  housingType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  areaName: string | null;
  positionName: string | null;
};

export type HomeOpenVacancy = {
  id: string;
  title: string;
  description: string | null;
  areaName: string;
  published: boolean;
};

export type HomePendingApproval = {
  id: string;
  title: string;
  requesterName: string;
};

export type HomePendingEvaluation = {
  id: string;
  status: string;
  scheduledAt: string | null;
  candidateName: string;
  vacancyTitle: string;
};

export class UpdateHomeCompanyInfoDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  publishedAt!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  unpublishedAt?: string | null;
}

export type HomeCompanyInfoMediaKind = 'IMAGE' | 'VIDEO';

export type HomeCompanyInfo = {
  title: string;
  description: string;
  publishedAt: string | null;
  unpublishedAt: string | null;
  mediaKind: HomeCompanyInfoMediaKind | null;
  hasMedia: boolean;
  isLive: boolean;
  mediaUpdatedAt: string | null;
};

export const EMPTY_HOME_COMPANY_INFO: HomeCompanyInfo = {
  title: '',
  description: '',
  publishedAt: null,
  unpublishedAt: null,
  mediaKind: null,
  hasMedia: false,
  isLive: false,
  mediaUpdatedAt: null,
};

export type CollaboratorHomeFeed = {
  profile: HomeProfile | null;
  openVacancies: HomeOpenVacancy[];
  pendingApprovals: HomePendingApproval[];
  pendingEvaluations: HomePendingEvaluation[];
  assignedVacancies: HomeAssignedVacancy[];
  assignedMetrics: HomeAssignedMetrics;
};

export type HomeAssignedVacancy = {
  id: string;
  title: string;
  status: string;
  areaName: string;
  headcount: number;
  filledCount: number;
  applicationCount: number;
};

export type HomeAssignedMetrics = {
  vacancyCount: number;
  openCount: number;
  applicationCount: number;
  activeApplicationCount: number;
  hiredCount: number;
  pendingInterviewCount: number;
  filledHeadcount: number;
  requestedHeadcount: number;
};

export const EMPTY_ASSIGNED_METRICS: HomeAssignedMetrics = {
  vacancyCount: 0,
  openCount: 0,
  applicationCount: 0,
  activeApplicationCount: 0,
  hiredCount: 0,
  pendingInterviewCount: 0,
  filledHeadcount: 0,
  requestedHeadcount: 0,
};
