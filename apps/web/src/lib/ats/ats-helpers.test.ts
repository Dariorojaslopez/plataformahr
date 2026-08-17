import { describe, expect, it } from "vitest";
import {
  toCreateVacancyRequestPayload,
  type VacancyRequestFormValues,
} from "@/components/ats/vacancy-request-form";
import {
  toCreateCandidatePayload,
  toUpdateCandidatePayload,
} from "@/components/ats/candidate-form";
import {
  APPLICATION_STAGE_LABELS,
  VACANCY_STATUS_LABELS,
} from "@/lib/ats/labels";
import {
  canMoveApplication,
  getValidMoveTargets,
  getVacancyStatusActions,
  isTerminalStage,
} from "@/lib/ats/transitions";

describe("vacancy request form payloads", () => {
  it("switches EXISTING_POSITION without NEW fields", () => {
    const values: VacancyRequestFormValues = {
      type: "EXISTING_POSITION",
      requestedByEmployeeId: "",
      existingPositionId: "pos-1",
      requestedPositionName: "should-ignore",
      requestedAreaId: "area-1",
      requestedJobLevelId: "jl-1",
      requestedHeadcount: "2",
      justification: "Need coverage",
      generalManagerApprovalRequired: false,
    };
    const payload = toCreateVacancyRequestPayload(values);
    expect(payload).toEqual({
      type: "EXISTING_POSITION",
      requestedHeadcount: 2,
      justification: "Need coverage",
      generalManagerApprovalRequired: false,
      existingPositionId: "pos-1",
    });
    expect(payload).not.toHaveProperty("requestedPositionName");
    expect(payload).not.toHaveProperty("requestedAreaId");
  });

  it("builds NEW_POSITION payload without existingPositionId", () => {
    const payload = toCreateVacancyRequestPayload({
      type: "NEW_POSITION",
      requestedByEmployeeId: "emp-1",
      existingPositionId: "pos-x",
      requestedPositionName: "Data Analyst",
      requestedAreaId: "area-1",
      requestedJobLevelId: "",
      requestedHeadcount: "1",
      justification: "Growth",
      generalManagerApprovalRequired: true,
    });
    expect(payload.existingPositionId).toBeUndefined();
    expect(payload.requestedPositionName).toBe("Data Analyst");
    expect(payload.requestedAreaId).toBe("area-1");
    expect(payload.requestedByEmployeeId).toBe("emp-1");
  });

  it("includes requestedByEmployeeId when a collaborator was selected", () => {
    const payload = toCreateVacancyRequestPayload({
      type: "EXISTING_POSITION",
      requestedByEmployeeId: "emp-selected",
      existingPositionId: "pos-1",
      requestedPositionName: "",
      requestedAreaId: "",
      requestedJobLevelId: "",
      requestedHeadcount: "1",
      justification: "Coverage",
      generalManagerApprovalRequired: false,
    });
    expect(payload.requestedByEmployeeId).toBe("emp-selected");
  });
});

describe("candidate form payloads", () => {
  it("omits empty optional fields on create", () => {
    expect(
      toCreateCandidatePayload({
        firstName: "Ana",
        lastName: "Ruiz",
        email: "ana@example.com",
        phone: "",
        documentType: "",
        documentNumber: "",
        country: "",
        state: "",
        city: "Bogotá",
        source: "LinkedIn",
        status: "",
      }),
    ).toEqual({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@example.com",
      city: "Bogotá",
      source: "LinkedIn",
    });
  });

  it("does not allow HIRED via update payload helper", () => {
    const payload = toUpdateCandidatePayload({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@example.com",
      phone: "",
      documentType: "",
      documentNumber: "",
      country: "",
      state: "",
      city: "",
      source: "",
      status: "HIRED",
    });
    expect(payload.status).toBeUndefined();
  });

  it("sends a stable catalog code when a document type is selected", () => {
    const payload = toCreateCandidatePayload({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@example.com",
      phone: "",
      documentType: "CC",
      documentNumber: "123",
      country: "",
      state: "",
      city: "",
      source: "",
      status: "",
    });
    expect(payload.documentType).toBe("CC");
    expect(payload.documentNumber).toBe("123");
  });

  it("omits a historical unknown documentType on update so other fields can save", () => {
    const payload = toUpdateCandidatePayload({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@example.com",
      phone: "",
      documentType: "Cedula",
      documentNumber: "123",
      country: "",
      state: "",
      city: "",
      source: "",
      status: "ACTIVE",
    });
    expect(payload).not.toHaveProperty("documentType");
    expect(payload.firstName).toBe("Ana");
    expect(payload.status).toBe("ACTIVE");
  });
});

describe("stage transitions", () => {
  it("exposes valid destinations and hides invalid ones", () => {
    expect(getValidMoveTargets("PENDING_REVIEW")).toEqual([
      "CONTACTED",
      "REJECTED",
      "WITHDRAWN",
    ]);
    expect(getValidMoveTargets("PENDING_REVIEW")).not.toContain("OFFER");
    expect(getValidMoveTargets("CONTACTED")).not.toContain("HIRED");
    expect(getValidMoveTargets("HIRED")).toEqual([]);
    expect(canMoveApplication("REJECTED")).toBe(false);
    expect(isTerminalStage("WITHDRAWN")).toBe(true);
  });

  it("maps vacancy status actions from backend matrix", () => {
    expect(getVacancyStatusActions("OPEN")).toEqual([
      "PAUSED",
      "CLOSED",
      "CANCELLED",
    ]);
    expect(getVacancyStatusActions("CLOSED")).toEqual([]);
  });
});

describe("labels", () => {
  it("centralizes Spanish stage and vacancy labels", () => {
    expect(APPLICATION_STAGE_LABELS.PENDING_REVIEW).toBe(
      "Pendiente de revisión",
    );
    expect(VACANCY_STATUS_LABELS.OPEN).toBe("Abierta");
  });
});
