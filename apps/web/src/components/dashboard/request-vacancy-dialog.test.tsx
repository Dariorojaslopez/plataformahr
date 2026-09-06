import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestVacancyDialog } from "@/components/dashboard/request-vacancy-dialog";

const createVacancyRequest = vi.fn();

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/lib/api/company", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/company")>(
    "@/lib/api/company",
  );
  return {
    ...actual,
    companyApi: {
      ...actual.companyApi,
      getCurrent: () =>
        Promise.resolve({
          id: "company-1",
          name: "Acme",
          slug: "acme",
          status: "ACTIVE",
          defaultLanguage: "ES",
          goalsCascadeEnabled: false,
          showNineBoxOnMyResults: true,
          vacancyHiringSlaDays: 14,
        }),
    },
  };
});

vi.mock("@/lib/api/organization", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/organization")
  >("@/lib/api/organization");
  return {
    ...actual,
    organizationApi: {
      ...actual.organizationApi,
      listPositions: () =>
        Promise.resolve([{ id: "pos-1", name: "Analista", headcount: 3 }]),
      listAreas: () =>
        Promise.resolve([{ id: "area-1", name: "Operaciones" }]),
      listJobLevels: () => Promise.resolve([]),
    },
  };
});

vi.mock("@/lib/api/ats", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/ats")>(
    "@/lib/api/ats",
  );
  return {
    ...actual,
    atsApi: {
      ...actual.atsApi,
      getVacancyApprovalWorkflow: () =>
        Promise.resolve({ enabled: true, steps: [], allowedRoles: [] }),
      listPositionOccupants: () =>
        Promise.resolve([
          {
            id: "emp-1",
            firstName: "Luis",
            lastName: "Pérez",
            email: "luis@example.com",
            userId: "user-1",
          },
        ]),
      createVacancyRequest: (...args: unknown[]) =>
        createVacancyRequest(...args),
    },
  };
});

vi.mock("@/lib/ui/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
});

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RequestVacancyDialog
        open
        onOpenChange={vi.fn()}
        linkedEmployeeExists
      />
    </QueryClientProvider>,
  );
}

describe("RequestVacancyDialog", () => {
  beforeEach(() => {
    createVacancyRequest.mockReset();
    createVacancyRequest.mockResolvedValue({ id: "req-1" });
  });

  it("opens the vacancy request form in a floating window", async () => {
    renderDialog();
    expect(
      await screen.findByText("Solicitar proceso de selección"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Niveles de aprobación")).toBeInTheDocument();
    expect(document.getElementById("vr-motive")).toBeInTheDocument();
    expect(document.getElementById("vr-hiring-date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Solicitante")).not.toBeInTheDocument();
    expect(
      screen.getByText(/No se pueden modificar ni agregar aprobadores/),
    ).toBeInTheDocument();
  });

  it("creates the request as the linked leader", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText("Niveles de aprobación");

    const positionTrigger = document.getElementById("vr-position");
    expect(positionTrigger).toBeTruthy();
    await user.click(positionTrigger!);
    await user.click(await screen.findByRole("option", { name: "Analista" }));

    const replacedTrigger = document.getElementById("vr-replaced");
    expect(replacedTrigger).toBeTruthy();
    await user.click(replacedTrigger!);
    await user.click(
      await screen.findByRole("option", { name: /Luis Pérez/ }),
    );

    await user.click(screen.getByRole("button", { name: "Crear solicitud" }));

    await waitFor(() => {
      expect(createVacancyRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          motive: "REPLACEMENT_RESIGNATION",
          existingPositionId: "pos-1",
          replacedEmployeeId: "emp-1",
          expectedHiringDate: expect.any(String),
        }),
      );
    });
  });
});
