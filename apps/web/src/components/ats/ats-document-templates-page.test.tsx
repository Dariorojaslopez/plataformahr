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
      updateAtsSettings: vi.fn(),
    },
  };
});

vi.mock("@/components/ats/email-html-editor", () => ({
  EmailHtmlEditor: ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (html: string) => void;
    id?: string;
  }) => (
    <textarea
      id={id}
      aria-label="Cuerpo del mensaje"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

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
    expect(screen.getAllByText("[Nombre]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Cargo]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Fecha del documento]").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("[Salario]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Forma de Pago]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Tipo de Contrato]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Fecha de Inicio]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Beneficios]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Ciudad]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Quien firma]").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Obligatorio Word/).length).toBeGreaterThan(0);

    const offerInput = document.querySelectorAll(
      'input[type="file"][accept*=".docx"]:not([accept*=".pdf"])',
    )[0] as HTMLInputElement;
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

  it("saves the offer-letter email subject and body", async () => {
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
    vi.mocked(companyApi.updateAtsSettings).mockResolvedValue({
      id: "company-1",
      name: "Acme",
      slug: "acme",
      status: "ACTIVE",
      defaultLanguage: "ES",
      goalsCascadeEnabled: false,
      showNineBoxOnMyResults: true,
      vacancyHiringSlaDays: 14,
    } as Awaited<ReturnType<typeof companyApi.updateAtsSettings>>);

    const user = userEvent.setup();
    renderPage();

    expect(
      (await screen.findAllByText("Configuración de correo de envío de plantilla"))
        .length,
    ).toBeGreaterThan(0);
    await user.type(
      screen.getByPlaceholderText("Te hacemos una oferta…"),
      "Tu oferta",
    );
    await user.type(
      screen.getAllByLabelText("Cuerpo del mensaje")[0]!,
      "Adjunto la carta",
    );
    await user.click(
      screen.getAllByRole("button", { name: "Guardar correo" })[0]!,
    );

    expect(companyApi.updateAtsSettings).toHaveBeenCalledWith({
      atsOfferLetterEmailSubject: "Tu oferta",
      atsOfferLetterEmailBody: "Adjunto la carta",
    });
  });
});
