import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  describeVacancyRequesterField,
  findLinkedEmployeeId,
  validateRequesterSelection,
  vacancyRequestSaveError,
  VACANCY_REQUESTER_MESSAGES,
} from "@/lib/ats/vacancy-requester";

describe("findLinkedEmployeeId", () => {
  const employees = [
    { id: "e-a", userId: "u-a" },
    { id: "e-b", userId: null },
  ];

  it("returns the employee linked to the current user in the same list", () => {
    expect(findLinkedEmployeeId(employees, "u-a")).toBe("e-a");
  });

  it("returns null when the user has no linked employee in the loaded list", () => {
    expect(findLinkedEmployeeId(employees, "u-missing")).toBeNull();
    expect(findLinkedEmployeeId(employees, null)).toBeNull();
  });
});

describe("describeVacancyRequesterField", () => {
  it("allows Yo when the user has a linked employee and proxy UI is on", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: true,
      canProxyRequester: true,
    });
    expect(field.showSelector).toBe(true);
    expect(field.allowSelfOption).toBe(true);
    expect(field.requesterRequired).toBe(false);
    expect(field.emptyLabel).toBe("Yo");
    expect(field.blocked).toBe(false);
  });

  it("does not offer Yo when there is no linked employee and proxy is allowed", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: false,
      canProxyRequester: true,
    });
    expect(field.showSelector).toBe(true);
    expect(field.allowSelfOption).toBe(false);
    expect(field.requesterRequired).toBe(true);
    expect(field.emptyLabel).toBeNull();
  });

  it("blocks create when there is no linked employee and no proxy", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: false,
      canProxyRequester: false,
    });
    expect(field.showSelector).toBe(false);
    expect(field.blocked).toBe(true);
    expect(field.blockedMessage).toBe(
      VACANCY_REQUESTER_MESSAGES.noLinkedEmployee,
    );
  });

  it("hides the selector for a linked user without proxy", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: true,
      canProxyRequester: false,
    });
    expect(field.showSelector).toBe(false);
    expect(field.blocked).toBe(false);
  });
});

describe("validateRequesterSelection", () => {
  it("requires a collaborator when the selector cannot be empty", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: false,
      canProxyRequester: true,
    });
    expect(validateRequesterSelection("", field)).toBe(
      VACANCY_REQUESTER_MESSAGES.selectRequester,
    );
    expect(validateRequesterSelection("emp-1", field)).toBeNull();
  });

  it("surfaces the blocked message before submit", () => {
    const field = describeVacancyRequesterField({
      linkedEmployeeExists: false,
      canProxyRequester: false,
    });
    expect(validateRequesterSelection("", field)).toBe(
      VACANCY_REQUESTER_MESSAGES.noLinkedEmployee,
    );
  });
});

describe("vacancyRequestSaveError", () => {
  it("shows the API Spanish message for 400 and 403", () => {
    expect(
      vacancyRequestSaveError(
        new ApiError(400, VACANCY_REQUESTER_MESSAGES.selectRequester),
      ),
    ).toBe(VACANCY_REQUESTER_MESSAGES.selectRequester);
    expect(
      vacancyRequestSaveError(
        new ApiError(403, VACANCY_REQUESTER_MESSAGES.cannotProxy),
      ),
    ).toBe(VACANCY_REQUESTER_MESSAGES.cannotProxy);
  });
});
