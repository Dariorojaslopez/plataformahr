import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RecruiterAssignmentSettingsPageClient } from "@/components/ats/recruiter-assignment-settings-page";
import { atsApi } from "@/lib/api/ats";

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/lib/api/ats", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/ats")>(
    "@/lib/api/ats",
  );
  return {
    ...actual,
    atsApi: {
      ...actual.atsApi,
      listActiveProcesses: vi.fn(),
      listRecruiters: vi.fn(),
      getVacancy: vi.fn(),
      updateVacancy: vi.fn(),
    },
  };
});

vi.mock("@/lib/ui/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RecruiterAssignmentSettingsPageClient />
    </QueryClientProvider>,
  );
}

describe("RecruiterAssignmentSettingsPageClient", () => {
  it("assigns a recruiter to an approved active process", async () => {
    vi.mocked(atsApi.listActiveProcesses).mockResolvedValue({
      items: [
        {
          id: "req-pending",
          status: "PENDING_APPROVAL",
          title: "Aún en aprobación",
          vacancyId: null,
          vacancyStatus: null,
          requestedByEmployee: {
            id: "emp-1",
            firstName: "Ana",
            lastName: "Ruiz",
            email: "ana@example.com",
          },
        },
        {
          id: "req-approved",
          status: "APPROVED",
          title: "Analista comercial",
          vacancyId: "vac-1",
          vacancyStatus: "OPEN",
          requestedByEmployee: {
            id: "emp-1",
            firstName: "Ana",
            lastName: "Ruiz",
            email: "ana@example.com",
          },
        },
      ],
    });
    vi.mocked(atsApi.getVacancy).mockResolvedValue({
      id: "vac-1",
      assignedRecruiterEmployeeId: null,
      assignedRecruiter: null,
    } as Awaited<ReturnType<typeof atsApi.getVacancy>>);
    vi.mocked(atsApi.listRecruiters).mockResolvedValue([
      {
        id: "emp-rec",
        firstName: "Luis",
        lastName: "Pérez",
        email: "luis@example.com",
      },
    ]);
    vi.mocked(atsApi.updateVacancy).mockResolvedValue({
      id: "vac-1",
      assignedRecruiterEmployeeId: "emp-rec",
    } as Awaited<ReturnType<typeof atsApi.updateVacancy>>);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Asignación de reclutador" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reclutador *"),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(document.getElementById("recruiter-assignment-process")!);
    expect(
      await screen.findByRole("option", { name: "Analista comercial" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Aún en aprobación" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Analista comercial" }));

    expect(
      await screen.findByLabelText("Reclutador *"),
    ).toBeInTheDocument();
    await user.click(document.getElementById("recruiter-assignment-recruiter")!);
    await user.click(await screen.findByRole("option", { name: "Luis Pérez" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(atsApi.updateVacancy).toHaveBeenCalledWith("vac-1", {
      assignedRecruiterEmployeeId: "emp-rec",
    });
  });
});
