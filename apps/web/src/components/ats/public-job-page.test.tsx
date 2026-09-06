import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PublicJobPage } from "@/components/ats/public-job-page";
import { publicJobsApi } from "@/lib/api/ats";
import type { PublicJob } from "@/types/ats";

vi.mock("@/lib/api/ats", () => ({
  publicJobsApi: {
    get: vi.fn().mockResolvedValue({
      publicId: "PublicJobId00001",
      title: "Desarrollador",
      description: "Construye productos.",
      positionName: "Desarrollador",
      mission: "Impulsar el producto.",
      responsibilities: "Entregar features.",
      requiredExperience: "3 años en React.",
      areaName: "Tecnología",
      companyName: "Acme",
      brandPrimaryColor: "#123456",
      hasLogo: false,
      publishedAt: new Date().toISOString(),
      salaryAmount: "4500000.00",
      salaryCurrency: "COP",
    }),
    apply: vi.fn().mockResolvedValue({ ok: true }),
    parseCv: vi.fn().mockResolvedValue({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@acme.test",
      phone: "3001234567",
      documentType: "CC",
      documentNumber: "1234567890",
      professionalProfile: "Desarrolladora full stack.",
      workExperience: [
        {
          companyName: "Acme",
          country: "",
          positionTitle: "Dev",
          startDate: "2020-01-01",
          endDate: "",
          isCurrent: true,
          functions: "APIs",
          achievements: "",
        },
      ],
      education: [
        {
          institution: "UNAL",
          program: "Sistemas",
          educationLevel: "PROFESSIONAL",
          startDate: "2014-01-01",
          endDate: "2019-01-01",
          isStudying: false,
        },
      ],
    }),
    parseLinkedIn: vi.fn().mockResolvedValue({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@acme.test",
      phone: null,
      documentType: null,
      documentNumber: null,
      professionalProfile: "Perfil LinkedIn",
      linkedinUrl: "https://www.linkedin.com/in/ana-ruiz",
      workExperience: [],
      education: [],
    }),
  },
}));

const previewJob: PublicJob = {
  publicId: null,
  title: "Analista",
  description: "Detalle interno de la vacante.",
  positionName: "Analista de talento",
  mission: "Atraer talento.",
  responsibilities: "Coordinar procesos.",
  requiredExperience: "2 años en ATS.",
  areaName: "People",
  companyName: "Acme",
  brandPrimaryColor: "#123456",
  hasLogo: false,
  publishedAt: null,
  salaryAmount: null,
  salaryCurrency: null,
};

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
});

afterEach(cleanup);

describe("PublicJobPage", () => {
  it("renders the public vacancy and application form without private shell", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PublicJobPage publicId="PublicJobId00001" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Desarrollador" }))
      .toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/COP/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Misión / visión" }))
      .toBeInTheDocument();
    expect(screen.getByText("Impulsar el producto.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Responsabilidades" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experiencia" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Formulario de postulación" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Archivo PDF o Word *")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico *")).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de nacimiento *")).toBeInTheDocument();
    expect(screen.getByText("Experiencia laboral")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Solo la primera es obligatoria/).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Formación académica")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows a recruiter preview without the application form", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PublicJobPage job={previewJob} preview />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Analista de talento" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Vista previa de la página pública/))
      .toBeInTheDocument();
    expect(screen.getByText("Atraer talento.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Formulario de postulación" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/COP/)).not.toBeInTheDocument();
  });

  it("uploads a CV and prefills the application form", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <PublicJobPage publicId="PublicJobId00001" />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "Formulario de postulación" });
    const file = new File(
      ["Ana Ruiz\nana@acme.test"],
      "cv.txt",
      { type: "text/plain" },
    );
    await user.upload(screen.getByLabelText("Archivo PDF o Word *"), file);

    expect(publicJobsApi.parseCv).toHaveBeenCalled();
    expect(await screen.findByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ruiz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ana@acme.test")).toBeInTheDocument();
    expect(
      screen.getByText("Revisa y corrige los datos extraídos de tu hoja de vida."),
    ).toBeInTheDocument();
  });
});
