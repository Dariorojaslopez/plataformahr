import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatEntityCounts,
  OrgImportPageClient,
} from "@/components/organization/org-import-page";
import { organizationApi } from "@/lib/api/organization";
import type { OrgImportPreview } from "@/types/organization";

vi.mock("@/lib/api/organization", () => ({
  organizationApi: {
    downloadImportTemplate: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
  },
}));

const summary = {
  businessUnits: { create: 1, update: 0, omit: 0 },
  areas: { create: 2, update: 1, omit: 0 },
  jobLevels: { create: 0, update: 0, omit: 0 },
  positions: { create: 0, update: 0, omit: 0 },
  employees: { create: 0, update: 0, omit: 0 },
  reportingLines: { create: 0, update: 0, omit: 0 },
};

function preview(overrides: Partial<OrgImportPreview> = {}): OrgImportPreview {
  return {
    rowsTotal: 3,
    rowsValid: 3,
    rowsInvalid: 0,
    rowsEmpty: 0,
    canApply: true,
    summary,
    issues: [],
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrgImportPageClient />
    </QueryClientProvider>,
  );
}

describe("OrgImportPageClient", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(organizationApi.previewImport).mockReset();
    vi.mocked(organizationApi.applyImport).mockReset();
  });

  it("formats the apply summary", () => {
    expect(formatEntityCounts("Áreas", { create: 8, update: 2, omit: 0 })).toBe(
      "Áreas: 8 creadas / 2 actualizadas",
    );
  });

  it("shows row errors and keeps apply disabled", async () => {
    const user = userEvent.setup();
    vi.mocked(organizationApi.previewImport).mockResolvedValue(
      preview({
        canApply: false,
        rowsInvalid: 1,
        rowsValid: 2,
        issues: [
          {
            row: 18,
            field: "positionName",
            level: "error",
            message: "Fila 18 · positionName: No existe el cargo ABC.",
          },
        ],
      }),
    );

    renderPage();
    const file = new File(["recordType,code\n"], "estructura.csv", {
      type: "text/csv",
    });
    await user.upload(screen.getByLabelText("Archivo Excel o CSV"), file);
    await user.click(screen.getByRole("button", { name: "Validar" }));

    expect(
      await screen.findByText("Fila 18 · positionName: No existe el cargo ABC."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar importación" })).toBeDisabled();
  });

  it("rejects a file that is not Excel or CSV", async () => {
    renderPage();
    const file = new File(["nope"], "estructura.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Archivo Excel o CSV"), {
      target: { files: [file] },
    });
    expect(
      await screen.findByText("Solo se admite Excel (.xlsx) o CSV UTF-8."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validar" })).toBeDisabled();
  });

  it("shows the final summary after a successful apply", async () => {
    const user = userEvent.setup();
    const ok = preview();
    vi.mocked(organizationApi.previewImport).mockResolvedValue(ok);
    vi.mocked(organizationApi.applyImport).mockResolvedValue({
      ...ok,
      applied: true,
    });

    renderPage();
    const file = new File(["recordType,code\n"], "estructura.csv", {
      type: "text/csv",
    });
    await user.upload(screen.getByLabelText("Archivo Excel o CSV"), file);
    await user.click(screen.getByRole("button", { name: "Validar" }));
    const apply = await screen.findByRole("button", { name: "Aplicar importación" });
    expect(apply).toBeEnabled();
    await user.click(apply);
    expect(await screen.findByTestId("import-result")).toHaveTextContent(
      "Unidades: 1 creadas",
    );
    expect(screen.getByTestId("import-result")).toHaveTextContent(
      "Áreas: 2 creadas / 1 actualizadas",
    );
  });
});
