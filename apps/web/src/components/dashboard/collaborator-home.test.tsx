import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollaboratorHome } from "@/components/dashboard/collaborator-home";
import type { CollaboratorHomeFeed } from "@/lib/api/home";
import { offersApi } from "@/lib/api/offers";

const getFeed = vi.fn();
const updateProfile = vi.fn();
const applyToVacancy = vi.fn();
const approveVacancyRequest = vi.fn();
const rejectVacancyRequest = vi.fn();
const listVacancies = vi.fn();

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/components/auth/session-provider", () => ({
  useSession: () => ({
    companyAccess: {
      enabledModules: ["ATS"],
      enabledFeatures: [
        "ats.vacancy-requests",
        "ats.interviews",
        "ats.vacancies",
      ],
    },
  }),
}));

vi.mock("@/lib/api/home", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/home")>(
    "@/lib/api/home",
  );
  return {
    ...actual,
    homeApi: {
      getFeed: () => getFeed(),
      updateProfile: (...args: unknown[]) => updateProfile(...args),
      applyToVacancy: (...args: unknown[]) => applyToVacancy(...args),
    },
  };
});

vi.mock("@/lib/api/ats", () => ({
  atsApi: {
    approveVacancyRequest: (...args: unknown[]) =>
      approveVacancyRequest(...args),
    rejectVacancyRequest: (...args: unknown[]) =>
      rejectVacancyRequest(...args),
    listVacancies: (...args: unknown[]) => listVacancies(...args),
  },
  atsKeys: {
    vacancyRequests: () => ["vacancy-requests"],
    vacancies: () => ["vacancies"],
  },
}));

vi.mock("@/components/dashboard/request-vacancy-dialog", () => ({
  RequestVacancyDialog: () => null,
}));

vi.mock("@/lib/ui/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("@/lib/api/offers", () => ({
  offersApi: {
    approveOfferLetterStep: vi.fn(),
    rejectOfferLetterStep: vi.fn(),
    downloadSignedLetter: vi.fn(),
  },
  offerKeys: {
    all: (companyId: string) => ["ats", companyId, "offers"],
  },
}));

const feed: CollaboratorHomeFeed = {
  profile: {
    id: "emp-1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@acme.test",
    phone: "3001234567",
    documentType: "CC",
    documentNumber: "123456",
    birthDate: "1990-01-15",
    country: null,
    state: null,
    city: null,
    maritalStatus: null,
    childrenCount: null,
    housingType: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    areaName: "Operaciones",
    positionName: "Analista",
  },
  openVacancies: [
    {
      id: "vac-1",
      title: "Desarrollador",
      description: "Backend",
      areaName: "Tecnología",
      published: true,
    },
  ],
  pendingApprovals: [
    { id: "req-1", title: "Líder de turno", requesterName: "Luis Díaz" },
  ],
  pendingEvaluations: [
    {
      id: "int-1",
      status: "SCHEDULED",
      scheduledAt: null,
      candidateName: "Carla Ruiz",
      vacancyTitle: "Desarrollador",
    },
  ],
  pendingContractApprovals: [],
  pendingOfferLetterApprovals: [],
  readyForOffer: [],
  assignedVacancies: [],
  teamMembers: [],
  assignedMetrics: {
    vacancyCount: 0,
    openCount: 0,
    applicationCount: 0,
    activeApplicationCount: 0,
    hiredCount: 0,
    pendingInterviewCount: 0,
    readyForOfferCount: 0,
    filledHeadcount: 0,
    requestedHeadcount: 0,
  },
};

function renderHome(
  props: {
    canRequestVacancies?: boolean;
    showAssignedWork?: boolean;
    showAllProcesses?: boolean;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CollaboratorHome
        canRequestVacancies={props.canRequestVacancies}
        showAssignedWork={props.showAssignedWork}
        showAllProcesses={props.showAllProcesses}
      />
    </QueryClientProvider>,
  );
}

describe("CollaboratorHome", () => {
  beforeEach(() => {
    getFeed.mockReset();
    updateProfile.mockReset();
    applyToVacancy.mockReset();
    approveVacancyRequest.mockReset();
    rejectVacancyRequest.mockReset();
    listVacancies.mockReset();
    getFeed.mockResolvedValue(feed);
    applyToVacancy.mockResolvedValue({ ok: true });
    listVacancies.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows vacancies, locked identity fields and conditional tasks", async () => {
    renderHome();

    expect(
      await screen.findByText("Procesos de selección activos"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Desarrollador").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Postularme" })).toBeInTheDocument();
    expect(screen.getByText("Información de perfil")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Pérez")).toBeInTheDocument();
    expect(screen.getByText("1990-01-15")).toBeInTheDocument();
    expect(screen.getByText(/Cédula de Ciudadanía 123456/)).toBeInTheDocument();
    expect(screen.getByText("Aprobaciones pendientes")).toBeInTheDocument();
    expect(screen.getByText("Candidatos por evaluar")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir al formulario de evaluación" }),
    ).toHaveAttribute("href", "/ats/interviews/int-1");
    expect(
      screen.queryByRole("button", { name: "Solicitar proceso de selección" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Procesos asignados")).not.toBeInTheDocument();
    expect(screen.queryByText("Métricas de tus procesos")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Todos los procesos de selección"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Personas a cargo")).not.toBeInTheDocument();
  });

  it("shows the vacancy request button for a leader", async () => {
    renderHome({ canRequestVacancies: true });
    expect(
      await screen.findByRole("button", {
        name: "Solicitar proceso de selección",
      }),
    ).toBeInTheDocument();
  });

  it("lists org-chart reports on the leader home", async () => {
    getFeed.mockResolvedValue({
      ...feed,
      teamMembers: [
        {
          id: "emp-2",
          firstName: "Maria",
          lastName: "Abril",
          positionName: "Analista de Selección",
          areaName: "Gestión Humana",
        },
        {
          id: "emp-3",
          firstName: "Nestor",
          lastName: "Agudelo",
          positionName: "Reclutador",
          areaName: "Gestión Humana",
        },
      ],
    });
    renderHome({ canRequestVacancies: true });
    expect(await screen.findByText("Personas a cargo")).toBeInTheDocument();
    expect(screen.getByText("Maria Abril")).toBeInTheDocument();
    expect(screen.getByText("Nestor Agudelo")).toBeInTheDocument();
    expect(screen.getByText(/Analista de Selección/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver organigrama" }),
    ).toHaveAttribute("href", "/organization/org-chart");
  });

  it("opens the application form in a dialog", async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByText("Procesos de selección activos");
    await user.click(screen.getByRole("button", { name: "Postularme" }));
    expect(screen.getByText("Postulación")).toBeInTheDocument();
    expect(
      screen.getByText(/El formulario se abre aquí/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar postulación" }));
    expect(applyToVacancy).toHaveBeenCalledWith("vac-1", {});
  });

  it("shows assigned processes and metrics for a recruiter", async () => {
    getFeed.mockResolvedValue({
      ...feed,
      assignedVacancies: [
        {
          id: "vac-2",
          title: "Soporte N2",
          status: "OPEN",
          areaName: "Servicio",
          headcount: 2,
          filledCount: 1,
          applicationCount: 4,
        },
      ],
      assignedMetrics: {
        vacancyCount: 1,
        openCount: 1,
        applicationCount: 4,
        activeApplicationCount: 3,
        hiredCount: 1,
        pendingInterviewCount: 2,
        filledHeadcount: 1,
        requestedHeadcount: 2,
      },
    });
    renderHome({ showAssignedWork: true });
    expect(await screen.findByRole("heading", { name: "Procesos asignados" })).toBeInTheDocument();
    expect(screen.getByText("Soporte N2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver proceso" })).toHaveAttribute(
      "href",
      "/ats/vacancies/vac-2",
    );
    expect(screen.getByText("Métricas de tus procesos")).toBeInTheDocument();
    expect(screen.getByText("Entrevistas pendientes")).toBeInTheDocument();
  });

  it("lists every company vacancy for an administrator", async () => {
    listVacancies.mockResolvedValue({
      items: [
        {
          id: "vac-open",
          title: "Analista de datos",
          status: "OPEN",
          headcount: 1,
          filledCount: 0,
          area: { name: "Analítica" },
          assignedRecruiter: {
            id: "emp-r",
            firstName: "Marta",
            lastName: "Gil",
            email: "marta@acme.test",
          },
        },
        {
          id: "vac-paused",
          title: "Soporte N2",
          status: "PAUSED",
          headcount: 2,
          filledCount: 1,
          area: { name: "Servicio" },
        },
      ],
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    renderHome({ showAllProcesses: true });
    expect(
      await screen.findByText("Todos los procesos de selección"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Analista de datos")).toBeInTheDocument();
    expect(screen.getByText("Soporte N2")).toBeInTheDocument();
    expect(screen.getByText("Pausada")).toBeInTheDocument();
    expect(screen.getByText(/Marta Gil/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/ats/vacancies",
    );
  });

  it("requires observations before accepting or rejecting a pending request", async () => {
    const user = userEvent.setup();
    approveVacancyRequest.mockResolvedValue({
      id: "req-1",
      status: "PENDING_APPROVAL",
    });
    rejectVacancyRequest.mockResolvedValue({
      id: "req-1",
      status: "REJECTED",
    });
    renderHome();
    await screen.findByText("Aprobaciones pendientes");
    expect(screen.getByLabelText("Observaciones *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
    await user.type(
      screen.getByLabelText("Observaciones *"),
      "Perfil alineado al cargo",
    );
    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(approveVacancyRequest).toHaveBeenCalledWith("req-1", {
      comment: "Perfil alineado al cargo",
    });
  });

  it("sends observations when rejecting a pending request", async () => {
    const user = userEvent.setup();
    rejectVacancyRequest.mockResolvedValue({
      id: "req-1",
      status: "REJECTED",
    });
    renderHome();
    await screen.findByText("Aprobaciones pendientes");
    await user.type(
      screen.getByLabelText("Observaciones *"),
      "Falta justificación de headcount",
    );
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(rejectVacancyRequest).toHaveBeenCalledWith("req-1", {
      comment: "Falta justificación de headcount",
    });
  });

  it("hides approval and evaluation sections when they are empty", async () => {
    getFeed.mockResolvedValue({
      ...feed,
      pendingApprovals: [],
      pendingEvaluations: [],
    });
    renderHome();
    await screen.findByText("Procesos de selección activos");
    expect(screen.queryByText("Aprobaciones pendientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidatos por evaluar")).not.toBeInTheDocument();
  });

  it("shows pending offer letters so the approver can approve and send", async () => {
    const user = userEvent.setup();
    getFeed.mockResolvedValue({
      ...feed,
      pendingApprovals: [],
      pendingOfferLetterApprovals: [
        {
          offerId: "offer-1",
          stepId: "step-1",
          candidateName: "Pedro Julian",
          vacancyTitle: "Reclutador",
          sequence: 1,
          isLastStep: true,
        },
      ],
    });
    renderHome();
    expect(
      await screen.findByText("Cartas oferta por aprobar"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedro Julian")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver carta" })).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Aprobar y enviar" });
    const reject = screen.getByRole("button", { name: "Rechazar" });
    expect(approve).toBeDisabled();
    expect(reject).toBeDisabled();
    await user.type(
      screen.getByLabelText("Observaciones *"),
      "Revisada y lista para envío",
    );
    await user.click(approve);
    expect(offersApi.approveOfferLetterStep).toHaveBeenCalledWith(
      "offer-1",
      "step-1",
      "Revisada y lista para envío",
    );
  });
});
