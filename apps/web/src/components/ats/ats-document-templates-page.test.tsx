import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtsDocumentTemplatesPageClient } from "@/components/ats/ats-document-templates-page";
import { companyApi } from "@/lib/api/company";
import { notifyError } from "@/lib/ui/notify";

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
      getCurrent: vi.fn(),
      uploadAtsTemplate: vi.fn(),
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
      <AtsDocumentTemplatesPageClient />
    </QueryClientProvider>,
  );
}

describe("AtsDocumentTemplatesPageClient offer letter", () => {
  it("lists Word placeholders and only accepts .docx for the offer letter", async () => {
    vi.mocked(companyApi.getCurrent).mockResolvedValue({
      id: "company-1",
      name: "Acme",
      slug: "acme",
      status: "ACTIVE",
      defaultLanguage: "ES",
      goalsCascadeEnabled: false,
      showNineBoxOnMyResults: true,
      vacancyHiringSlaDays: 14,
      hasOfferLetterTemplate: false,
      hasContractTemplate: false,
    } as Awaited<ReturnType<typeof companyApi.getCurrent>>);

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Carta de oferta")).toBeInTheDocument();
    expect(screen.getByText("[Nombre]")).toBeInTheDocument();
    expect(screen.getByText("[Cargo]")).toBeInTheDocument();
    expect(screen.getByText("[Fecha del documento]")).toBeInTheDocument();
    expect(screen.getByText("[Salario]")).toBeInTheDocument();
    expect(screen.getByText("[Forma de Pago]")).toBeInTheDocument();
    expect(screen.getByText("[Tipo de Contrato]")).toBeInTheDocument();
    expect(screen.getByText("[Fecha de Inicio]")).toBeInTheDocument();
    expect(screen.getByText("[Beneficios]")).toBeInTheDocument();
    expect(screen.getByText("[Ciudad]")).toBeInTheDocument();
    expect(screen.getByText("[Quien firma]")).toBeInTheDocument();
    expect(screen.getByText(/Obligatorio Word/)).toBeInTheDocument();

    const offerInput = document.querySelector(
      'input[type="file"][accept*=".docx"]:not([accept*=".pdf"])',
    ) as HTMLInputElement;
    expect(offerInput).toBeTruthy();
    expect(offerInput.accept).not.toContain(".pdf");

    const docx = new File(["PK"], "carta.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(offerInput, docx);
    expect(companyApi.uploadAtsTemplate).toHaveBeenCalledWith(
      "offer-letter",
      docx,
    );
    expect(notifyError).not.toHaveBeenCalled();
  });
});
