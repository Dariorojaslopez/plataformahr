import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestVacancyDialog } from "@/components/dashboard/request-vacancy-dialog";

const createVacancyRequest = vi.fn();

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/lib/api/organization", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/organization")
  >("@/lib/api/organization");
  return {
    ...actual,
    organizationApi: {
      ...actual.organizationApi,
      listPositions: () =>
        Promise.resolve([{ id: "pos-1", name: "Analista" }]),
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
    expect(
      await screen.findByLabelText("Justificación *"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Solicitante")).not.toBeInTheDocument();
    expect(screen.getByText("Niveles de aprobación")).toBeInTheDocument();
    expect(
      screen.queryByText("Requiere aprobación de Gerencia General"),
    ).not.toBeInTheDocument();
  });

  it("creates the request as the linked leader", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByLabelText("Justificación *");

    const positionTrigger = document.getElementById("vr-position");
    expect(positionTrigger).toBeTruthy();
    await user.click(positionTrigger!);
    await user.click(await screen.findByRole("option", { name: "Analista" }));

    await user.type(screen.getByLabelText("Justificación *"), "Cobertura de turno");
    await user.click(screen.getByRole("button", { name: "Crear solicitud" }));

    await waitFor(() => {
      expect(createVacancyRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXISTING_POSITION",
          existingPositionId: "pos-1",
          justification: "Cobertura de turno",
        }),
      );
    });
  });
});
