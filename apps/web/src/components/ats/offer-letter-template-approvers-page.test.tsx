import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfferLetterTemplateApproversPageClient } from "@/components/ats/offer-letter-template-approvers-page";
import { atsApi } from "@/lib/api/ats";
import { organizationApi } from "@/lib/api/organization";

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
      getOfferLetterTemplateApprovers: vi.fn(),
      listPositionOccupants: vi.fn(),
    },
  };
});

vi.mock("@/lib/api/organization", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/organization")>(
    "@/lib/api/organization",
  );
  return {
    ...actual,
    organizationApi: {
      ...actual.organizationApi,
      listPositions: vi.fn(),
    },
  };
});

vi.mock("@/lib/ui/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OfferLetterTemplateApproversPageClient />
    </QueryClientProvider>,
  );
}

describe("OfferLetterTemplateApproversPageClient", () => {
  it("asks for occupant name when the cargo has more than one person", async () => {
    vi.mocked(atsApi.getOfferLetterTemplateApprovers).mockResolvedValue({
      steps: [
        {
          id: "step-1",
          sequence: 1,
          positionId: "pos-recruiter",
          employeeId: null,
          position: { id: "pos-recruiter", name: "Reclutador" },
          employee: null,
        },
      ],
    });
    vi.mocked(organizationApi.listPositions).mockResolvedValue([
      {
        id: "pos-recruiter",
        name: "Reclutador",
        status: "ACTIVE",
      },
    ] as Awaited<ReturnType<typeof organizationApi.listPositions>>);
    vi.mocked(atsApi.listPositionOccupants).mockResolvedValue([
      {
        id: "emp-1",
        firstName: "Nestor",
        lastName: "Agudelo",
        email: "nestor@acme.test",
        userId: "u-1",
      },
      {
        id: "emp-2",
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@acme.test",
        userId: "u-2",
      },
    ]);

    renderPage();

    expect(
      await screen.findByText("Aprobadores de carta oferta"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Nombre del ocupante *")).toBeInTheDocument();
  });
});
