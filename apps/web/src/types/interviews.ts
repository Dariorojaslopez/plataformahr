export type InterviewType =
  | "HR"
  | "TECHNICAL"
  | "MANAGER"
  | "GENERAL"
  | "OTHER";

export type InterviewStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type InterviewFormStatus = "ACTIVE" | "INACTIVE";

export type InterviewQuestionType = "TEXT" | "TEXTAREA" | "RATING" | "YES_NO";

export type TranscriptSegmentKind =
  | "QUESTION"
  | "ANSWER"
  | "NOTE"
  | "UNCLASSIFIED";

export type InterviewEmployeeRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  userId?: string | null;
};

export type InterviewInterviewer = {
  interviewId: string;
  employeeId: string;
  createdAt: string;
  employee?: InterviewEmployeeRef;
};

export type InterviewAnswer = {
  id: string;
  answerText: string | null;
  rating: number | null;
  yesNo: boolean | null;
  answeredByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewQuestion = {
  id: string;
  companyId: string;
  interviewId: string;
  sourceTemplateQuestionId: string | null;
  text: string;
  type: InterviewQuestionType;
  required: boolean;
  weight: number | null;
  order: number;
  createdAt: string;
  answers?: InterviewAnswer[];
};

export type InterviewTranscriptSegment = {
  id: string;
  sequence: number;
  speakerLabel: string | null;
  kind: TranscriptSegmentKind;
  text: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Interview = {
  id: string;
  companyId: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  localRecordingName: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  interviewers?: InterviewInterviewer[];
  questions?: InterviewQuestion[];
  transcripts?: InterviewTranscriptSegment[];
  _count?: { questions: number; transcripts: number };
};

export type InterviewListItem = Interview;

export type PendingInterview = InterviewListItem & {
  application?: {
    id: string;
    stage: string;
    candidate?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    vacancy?: {
      id: string;
      title: string;
      interviewFormTemplateId?: string | null;
    } | null;
  };
};

export type InterviewFormQuestion = {
  id: string;
  companyId: string;
  templateId: string;
  text: string;
  type: InterviewQuestionType;
  required: boolean;
  weight: number | null;
  order: number;
  createdAt: string;
  updatedAt?: string;
};

export type InterviewFormTemplate = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  type: InterviewType;
  status: InterviewFormStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  questions?: InterviewFormQuestion[];
};

export type CreateInterviewInput = {
  type: InterviewType;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  localRecordingName?: string;
  interviewerEmployeeIds: string[];
  templateId?: string;
};

export type UpdateInterviewInput = {
  scheduledAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
  localRecordingName?: string | null;
  interviewerEmployeeIds?: string[];
};

export type UpsertInterviewAnswerInput = {
  answerText?: string;
  rating?: number;
  yesNo?: boolean;
};

export type CreateTranscriptSegmentInput = {
  text: string;
  kind?: TranscriptSegmentKind;
  speakerLabel?: string;
};

export type UpdateTranscriptSegmentInput = {
  text?: string;
  kind?: TranscriptSegmentKind;
  speakerLabel?: string | null;
};

export type TemplateQuestionInput = {
  text: string;
  type: InterviewQuestionType;
  required?: boolean;
  weight?: number;
  order: number;
};

export type CreateInterviewFormTemplateInput = {
  name: string;
  description?: string;
  type: InterviewType;
  questions?: TemplateQuestionInput[];
};

export type UpdateInterviewFormTemplateInput = {
  name?: string;
  description?: string | null;
  type?: InterviewType;
  status?: InterviewFormStatus;
};

export type AddTemplateQuestionInput = TemplateQuestionInput;
