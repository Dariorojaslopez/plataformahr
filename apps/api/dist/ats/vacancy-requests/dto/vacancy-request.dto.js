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
exports.RejectDecisionDto = exports.ApprovalDecisionDto = exports.ListVacancyRequestsQueryDto = exports.UpdateVacancyRequestDto = exports.CreateVacancyRequestDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const ats_constants_1 = require("../../ats.constants");
class CreateVacancyRequestDto {
    type;
    requestedByEmployeeId;
    existingPositionId;
    requestedPositionName;
    requestedAreaId;
    requestedJobLevelId;
    requestedHeadcount;
    justification;
    generalManagerApprovalRequired;
}
exports.CreateVacancyRequestDto = CreateVacancyRequestDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.VacancyRequestType),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "requestedByEmployeeId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.type === client_1.VacancyRequestType.EXISTING_POSITION),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "existingPositionId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.type === client_1.VacancyRequestType.NEW_POSITION),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "requestedPositionName", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.type === client_1.VacancyRequestType.NEW_POSITION),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "requestedAreaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "requestedJobLevelId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateVacancyRequestDto.prototype, "requestedHeadcount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], CreateVacancyRequestDto.prototype, "justification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateVacancyRequestDto.prototype, "generalManagerApprovalRequired", void 0);
class UpdateVacancyRequestDto {
    type;
    requestedByEmployeeId;
    existingPositionId;
    requestedPositionName;
    requestedAreaId;
    requestedJobLevelId;
    requestedHeadcount;
    justification;
    generalManagerApprovalRequired;
}
exports.UpdateVacancyRequestDto = UpdateVacancyRequestDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VacancyRequestType),
    __metadata("design:type", String)
], UpdateVacancyRequestDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateVacancyRequestDto.prototype, "requestedByEmployeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateVacancyRequestDto.prototype, "existingPositionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateVacancyRequestDto.prototype, "requestedPositionName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateVacancyRequestDto.prototype, "requestedAreaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateVacancyRequestDto.prototype, "requestedJobLevelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateVacancyRequestDto.prototype, "requestedHeadcount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpdateVacancyRequestDto.prototype, "justification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateVacancyRequestDto.prototype, "generalManagerApprovalRequired", void 0);
class ListVacancyRequestsQueryDto {
    status;
    type;
    requestedByEmployeeId;
    search;
    page = ats_constants_1.DEFAULT_PAGE;
    limit = ats_constants_1.DEFAULT_LIMIT;
}
exports.ListVacancyRequestsQueryDto = ListVacancyRequestsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VacancyRequestStatus),
    __metadata("design:type", String)
], ListVacancyRequestsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VacancyRequestType),
    __metadata("design:type", String)
], ListVacancyRequestsQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListVacancyRequestsQueryDto.prototype, "requestedByEmployeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListVacancyRequestsQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListVacancyRequestsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(ats_constants_1.MAX_LIMIT),
    __metadata("design:type", Number)
], ListVacancyRequestsQueryDto.prototype, "limit", void 0);
class ApprovalDecisionDto {
    comment;
}
exports.ApprovalDecisionDto = ApprovalDecisionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ApprovalDecisionDto.prototype, "comment", void 0);
class RejectDecisionDto {
    comment;
}
exports.RejectDecisionDto = RejectDecisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], RejectDecisionDto.prototype, "comment", void 0);
//# sourceMappingURL=vacancy-request.dto.js.map