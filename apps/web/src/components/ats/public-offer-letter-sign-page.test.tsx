import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PublicOfferLetterSignPage } from "@/components/ats/public-offer-letter-sign-page";
import { publicOfferLetterApi } from "@/lib/api/offers";

vi.mock("@/lib/api/offers", () => ({
  publicOfferLetterApi: {
    get: vi.fn(),
    sign: vi.fn(),
  },
  publicOfferLetterDocumentUrl: (token: string) =>
    `/public/offer-letters/${token}/document`,
}));

vi.mock("@/lib/api/client", () => ({
  publicApiAssetUrl: (path: string) => path,
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PublicOfferLetterSignPage token="token-1" />
    </QueryClientProvider>,
  );
}

describe("PublicOfferLetterSignPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("previews the letter and requires accept plus signature image", async () => {
    vi.mocked(publicOfferLetterApi.get).mockResolvedValue({
      token: "token-1",
      companyName: "Acme",
      candidateName: "Pedro Julian",
      positionTitle: "Reclutador",
      signed: false,
      signedAt: null,
      documentName: "carta.docx",
      documentMime:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    renderPage();
    expect(await screen.findByText("Carta oferta")).toBeInTheDocument();
    expect(screen.getByText(/Pedro Julian/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Descargar documento" }),
    ).toHaveAttribute("href", "/public/offer-letters/token-1/document");
    expect(
      screen.getByRole("button", { name: "Guardar firma" }),
    ).toBeDisabled();

    const user = userEvent.setup();
    const file = new File(["sig"], "firma.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Imagen de tu firma"), file);
    await user.click(screen.getByLabelText("Aceptar carta oferta"));
    expect(
      screen.getByRole("button", { name: "Guardar firma" }),
    ).toBeEnabled();
  });

  it("shows a confirmation after the letter is already signed", async () => {
    vi.mocked(publicOfferLetterApi.get).mockResolvedValue({
      token: "token-1",
      companyName: "Acme",
      candidateName: "Pedro Julian",
      positionTitle: "Reclutador",
      signed: true,
      signedAt: "2026-09-16T20:00:00.000Z",
      documentName: "carta.pdf",
      documentMime: "application/pdf",
    });
    renderPage();
    expect(await screen.findByText(/Carta oferta firmada/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Imagen de tu firma")).not.toBeInTheDocument();
  });
});
