import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformPremiumSection } from "@/components/platform/platform-premium-section";
import type { ManagedCompany } from "@/types/auth";

const updatePremium = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  updateManagedCompanyPremiumRequest: (...args: unknown[]) =>
    updatePremium(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const company: ManagedCompany = {
  id: "company-1",
  name: "Acme",
  legalName: null,
  slug: "acme",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  membershipCount: 1,
  enabledModules: ["ATS"],
  enabledFeatures: ["ats.vacancies"],
  initialAdmin: null,
};

describe("PlatformPremiumSection", () => {
  afterEach(() => {
    cleanup();
    updatePremium.mockReset();
  });

  it("toggles a premium option for a company", async () => {
    updatePremium.mockResolvedValue({});
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <PlatformPremiumSection companies={[company]} onSaved={onSaved} />,
    );

    expect(screen.getByText("Opciones premium")).toBeInTheDocument();
    expect(screen.getByText("Firma digital")).toBeInTheDocument();
    expect(screen.getByText("Grabación de entrevista")).toBeInTheDocument();
    expect(screen.getByText("Generación de PDI")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    await waitFor(() => {
      expect(updatePremium).toHaveBeenCalledWith("company-1", {
        digitalSignature: true,
        interviewRecording: false,
        pdi: false,
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
