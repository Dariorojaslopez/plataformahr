import { describe, expect, it } from "vitest";
import {
  canProxyVacancyRequester,
  isLeaderSelectionProcessView,
  selectionProcessNavLabel,
  selectionProcessPageTitle,
} from "@/lib/ats/vacancy-requests-view";

describe("vacancy requests view", () => {
  it("uses a personal title and nav label for the leader front", () => {
    expect(isLeaderSelectionProcessView("LEADER")).toBe(true);
    expect(selectionProcessPageTitle("LEADER")).toBe(
      "Mis procesos de selección",
    );
    expect(selectionProcessNavLabel("LEADER")).toBe(
      "Mis procesos de selección",
    );
  });

  it("keeps the company-wide copy for administrators and recruiters", () => {
    expect(selectionProcessPageTitle("CLIENT_ADMIN")).toBe(
      "Crear proceso de selección",
    );
    expect(selectionProcessNavLabel("RECRUITER")).toBe(
      "Crear proceso de selección",
    );
    expect(isLeaderSelectionProcessView("CLIENT_ADMIN")).toBe(false);
  });

  it("lets only admin and recruiter create requests on behalf of someone else", () => {
    expect(canProxyVacancyRequester(["LEADER"])).toBe(false);
    expect(canProxyVacancyRequester(["CLIENT_ADMIN"])).toBe(true);
    expect(canProxyVacancyRequester(["RECRUITER", "LEADER"])).toBe(true);
  });
});
