import { InterviewFormStatus, InterviewQuestionType, InterviewType, TranscriptSegmentKind } from '@prisma/client';
export declare class CreateInterviewDto {
    type: InterviewType;
    scheduledAt?: string;
    location?: string;
    meetingUrl?: string;
    notes?: string;
    localRecordingName?: string;
    interviewerEmployeeIds: string[];
    templateId?: string;
}
export declare class UpdateInterviewDto {
    scheduledAt?: string | null;
    location?: string | null;
    meetingUrl?: string | null;
    notes?: string | null;
    localRecordingName?: string | null;
    interviewerEmployeeIds?: string[];
}
export declare class UpsertInterviewAnswerDto {
    answerText?: string;
    rating?: number;
    yesNo?: boolean;
}
export declare class CreateTranscriptSegmentDto {
    text: string;
    kind?: TranscriptSegmentKind;
    speakerLabel?: string;
}
export declare class UpdateTranscriptSegmentDto {
    text?: string;
    kind?: TranscriptSegmentKind;
    speakerLabel?: string | null;
}
export declare class TemplateQuestionInputDto {
    text: string;
    type: InterviewQuestionType;
    required?: boolean;
    weight?: number;
    order: number;
}
export declare class CreateInterviewFormTemplateDto {
    name: string;
    description?: string;
    type: InterviewType;
    questions?: TemplateQuestionInputDto[];
}
export declare class UpdateInterviewFormTemplateDto {
    name?: string;
    description?: string | null;
    type?: InterviewType;
    status?: InterviewFormStatus;
}
export declare class AddTemplateQuestionDto extends TemplateQuestionInputDto {
}
