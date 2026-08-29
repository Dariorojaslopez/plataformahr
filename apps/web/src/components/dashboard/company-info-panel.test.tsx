import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyInfoPanel } from "@/components/dashboard/company-info-panel";
import { EMPTY_HOME_COMPANY_INFO, type HomeCompanyInfo } from "@/lib/api/home";

const getCompanyInfo = vi.fn();
const updateCompanyInfo = vi.fn();
const uploadCompanyInfoMedia = vi.fn();
const getCompanyInfoMediaBlob = vi.fn();

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/lib/api/home", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/home")>(
    "@/lib/api/home",
  );
  return {
    ...actual,
    homeApi: {
      getCompanyInfo: () => getCompanyInfo(),
      updateCompanyInfo: (...args: unknown[]) => updateCompanyInfo(...args),
      uploadCompanyInfoMedia: (...args: unknown[]) =>
        uploadCompanyInfoMedia(...args),
      removeCompanyInfoMedia: vi.fn(),
      getCompanyInfoMediaBlob: () => getCompanyInfoMediaBlob(),
    },
  };
});

vi.mock("@/lib/ui/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const liveInfo: HomeCompanyInfo = {
  title: "Nuestra cultura",
  description: "Así trabajamos",
  publishedAt: "2026-01-01T00:00:00.000Z",
  unpublishedAt: "2027-01-01T00:00:00.000Z",
  mediaKind: "IMAGE",
  hasMedia: true,
  isLive: true,
  mediaUpdatedAt: "2026-01-02T00:00:00.000Z",
};

function renderPanel(canManage: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompanyInfoPanel canManage={canManage} />
    </QueryClientProvider>,
  );
}

describe("CompanyInfoPanel", () => {
  beforeEach(() => {
    getCompanyInfo.mockReset();
    updateCompanyInfo.mockReset();
    uploadCompanyInfoMedia.mockReset();
    getCompanyInfoMediaBlob.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    getCompanyInfoMediaBlob.mockResolvedValue({
      blob: new Blob(["x"], { type: "image/png" }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("hides the panel for viewers when nothing is published", async () => {
    getCompanyInfo.mockResolvedValue(EMPTY_HOME_COMPANY_INFO);
    renderPanel(false);
    await waitFor(() => {
      expect(getCompanyInfo).toHaveBeenCalled();
    });
    expect(
      screen.queryByText("Información de la compañía"),
    ).not.toBeInTheDocument();
  });

  it("shows published title and description to viewers", async () => {
    getCompanyInfo.mockResolvedValue(liveInfo);
    renderPanel(false);
    expect(
      await screen.findByRole("heading", { name: "Información de la compañía" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nuestra cultura")).toBeInTheDocument();
    expect(screen.getByText("Así trabajamos")).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  });

  it("shows the editor form to administrators", async () => {
    getCompanyInfo.mockResolvedValue(EMPTY_HOME_COMPANY_INFO);
    renderPanel(true);
    expect(await screen.findByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de publicación")).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de despublicación")).toBeInTheDocument();
    expect(screen.getByLabelText("Imagen o video")).toBeInTheDocument();
  });

  it("saves title, description and schedule", async () => {
    getCompanyInfo.mockResolvedValue(EMPTY_HOME_COMPANY_INFO);
    updateCompanyInfo.mockResolvedValue({
      ...EMPTY_HOME_COMPANY_INFO,
      title: "Bienvenida",
      description: "Hola equipo",
      isLive: false,
    });
    const user = userEvent.setup();
    renderPanel(true);

    await screen.findByLabelText("Título");
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Bienvenida");
    await user.type(screen.getByLabelText("Descripción"), "Hola equipo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(updateCompanyInfo).toHaveBeenCalled();
    });
    const body = updateCompanyInfo.mock.calls[0][0] as {
      title: string;
      description: string;
      publishedAt: string;
    };
    expect(body.title).toBe("Bienvenida");
    expect(body.description).toBe("Hola equipo");
    expect(body.publishedAt).toMatch(/^\d{4}-/);
  });
});
