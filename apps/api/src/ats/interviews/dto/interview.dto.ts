import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InterviewFormStatus,
  InterviewQuestionType,
  InterviewType,
  TranscriptSegmentKind,
} from '@prisma/client';

export class CreateInterviewDto {
  @IsEnum(InterviewType)
  type!: InterviewType;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  localRecordingName?: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  interviewerEmployeeIds!: string[];

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  localRecordingName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  interviewerEmployeeIds?: string[];
}

export class UpsertInterviewAnswerDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  answerText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  yesNo?: boolean;
}

export class CreateTranscriptSegmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text!: string;

  @IsOptional()
  @IsEnum(TranscriptSegmentKind)
  kind?: TranscriptSegmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  speakerLabel?: string;
}

export class UpdateTranscriptSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsEnum(TranscriptSegmentKind)
  kind?: TranscriptSegmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  speakerLabel?: string | null;
}

export class TemplateQuestionInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsEnum(InterviewQuestionType)
  type!: InterviewQuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weight?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

export class CreateInterviewFormTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(InterviewType)
  type!: InterviewType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateQuestionInputDto)
  questions?: TemplateQuestionInputDto[];
}

export class UpdateInterviewFormTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @IsOptional()
  @IsEnum(InterviewFormStatus)
  status?: InterviewFormStatus;
}

export class AddTemplateQuestionDto extends TemplateQuestionInputDto {}
