"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTemplateQuestionDto = exports.UpdateInterviewFormTemplateDto = exports.CreateInterviewFormTemplateDto = exports.TemplateQuestionInputDto = exports.UpdateTranscriptSegmentDto = exports.CreateTranscriptSegmentDto = exports.UpsertInterviewAnswerDto = exports.UpdateInterviewDto = exports.CreateInterviewDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class CreateInterviewDto {
    type;
    scheduledAt;
    location;
    meetingUrl;
    notes;
    localRecordingName;
    interviewerEmployeeIds;
    templateId;
}
exports.CreateInterviewDto = CreateInterviewDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.InterviewType),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "meetingUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "localRecordingName", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CreateInterviewDto.prototype, "interviewerEmployeeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateInterviewDto.prototype, "templateId", void 0);
class UpdateInterviewDto {
    scheduledAt;
    location;
    meetingUrl;
    notes;
    localRecordingName;
    interviewerEmployeeIds;
}
exports.UpdateInterviewDto = UpdateInterviewDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", Object)
], UpdateInterviewDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], UpdateInterviewDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], UpdateInterviewDto.prototype, "meetingUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], UpdateInterviewDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], UpdateInterviewDto.prototype, "localRecordingName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], UpdateInterviewDto.prototype, "interviewerEmployeeIds", void 0);
class UpsertInterviewAnswerDto {
    answerText;
    rating;
    yesNo;
}
exports.UpsertInterviewAnswerDto = UpsertInterviewAnswerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], UpsertInterviewAnswerDto.prototype, "answerText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], UpsertInterviewAnswerDto.prototype, "rating", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertInterviewAnswerDto.prototype, "yesNo", void 0);
class CreateTranscriptSegmentDto {
    text;
    kind;
    speakerLabel;
}
exports.CreateTranscriptSegmentDto = CreateTranscriptSegmentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], CreateTranscriptSegmentDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TranscriptSegmentKind),
    __metadata("design:type", String)
], CreateTranscriptSegmentDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateTranscriptSegmentDto.prototype, "speakerLabel", void 0);
class UpdateTranscriptSegmentDto {
    text;
    kind;
    speakerLabel;
}
exports.UpdateTranscriptSegmentDto = UpdateTranscriptSegmentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(10000),
    __metadata("design:type", String)
], UpdateTranscriptSegmentDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TranscriptSegmentKind),
    __metadata("design:type", String)
], UpdateTranscriptSegmentDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateTranscriptSegmentDto.prototype, "speakerLabel", void 0);
class TemplateQuestionInputDto {
    text;
    type;
    required;
    weight;
    order;
}
exports.TemplateQuestionInputDto = TemplateQuestionInputDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], TemplateQuestionInputDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.InterviewQuestionType),
    __metadata("design:type", String)
], TemplateQuestionInputDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TemplateQuestionInputDto.prototype, "required", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TemplateQuestionInputDto.prototype, "weight", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TemplateQuestionInputDto.prototype, "order", void 0);
class CreateInterviewFormTemplateDto {
    name;
    description;
    type;
    questions;
}
exports.CreateInterviewFormTemplateDto = CreateInterviewFormTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateInterviewFormTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateInterviewFormTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.InterviewType),
    __metadata("design:type", String)
], CreateInterviewFormTemplateDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TemplateQuestionInputDto),
    __metadata("design:type", Array)
], CreateInterviewFormTemplateDto.prototype, "questions", void 0);
class UpdateInterviewFormTemplateDto {
    name;
    description;
    type;
    status;
}
exports.UpdateInterviewFormTemplateDto = UpdateInterviewFormTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateInterviewFormTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], UpdateInterviewFormTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.InterviewType),
    __metadata("design:type", String)
], UpdateInterviewFormTemplateDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.InterviewFormStatus),
    __metadata("design:type", String)
], UpdateInterviewFormTemplateDto.prototype, "status", void 0);
class AddTemplateQuestionDto extends TemplateQuestionInputDto {
}
exports.AddTemplateQuestionDto = AddTemplateQuestionDto;
//# sourceMappingURL=interview.dto.js.map