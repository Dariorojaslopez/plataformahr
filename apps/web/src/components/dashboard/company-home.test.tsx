import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyHome } from "@/components/dashboard/company-home";
import { HOME_SHORTCUTS } from "@/lib/home/home-view";

vi.mock("@/components/dashboard/collaborator-home", () => ({
  CollaboratorHome: () => <div>Procesos de selección activos</div>,
}));

vi.mock("@/components/dashboard/company-info-panel", () => ({
  CompanyInfoPanel: () => (
    <aside>Información de la compañía</aside>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("CompanyHome", () => {
  it("shows collaborator work, not company administration", () => {
    render(
      <CompanyHome
        firstName="Ana"
        companyName="Acme"
        companySlug="acme"
        homeRole="COLLABORATOR"
        hasDirectReports={false}
        shortcuts={HOME_SHORTCUTS.COLLABORATOR}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Hola, Ana" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Colaborador")).toBeInTheDocument();
    expect(screen.getByText("Procesos de selección activos")).toBeInTheDocument();
    expect(screen.getByText("Información de la compañía")).toBeInTheDocument();
    expect(screen.queryByText("Compañía activa")).not.toBeInTheDocument();
    expect(screen.queryByText("Colaboradores")).not.toBeInTheDocument();
    expect(screen.queryByText("Pipeline")).not.toBeInTheDocument();
  });

  it("shows leader people home, not recruiter shortcuts", () => {
    render(
      <CompanyHome
        firstName="Luis"
        companyName="Acme"
        companySlug="acme"
        homeRole="LEADER"
        hasDirectReports={false}
        shortcuts={HOME_SHORTCUTS.LEADER}
      />,
    );

    expect(screen.getByText("Líder")).toBeInTheDocument();
    expect(screen.getByText("Procesos de selección activos")).toBeInTheDocument();
    expect(
      screen.getByText(/Aún no tienes reportes directos/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mi equipo")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidatos")).not.toBeInTheDocument();
  });

  it("hides the empty-reports note when the leader has people", () => {
    render(
      <CompanyHome
        firstName="Luis"
        companyName="Acme"
        companySlug="acme"
        homeRole="LEADER"
        hasDirectReports
        shortcuts={HOME_SHORTCUTS.LEADER}
      />,
    );

    expect(
      screen.queryByText(/Aún no tienes reportes directos/),
    ).not.toBeInTheDocument();
  });

  it("shows recruiter assigned work, not admin shortcuts", () => {
    render(
      <CompanyHome
        firstName="Marta"
        companyName="Acme"
        companySlug="acme"
        homeRole="RECRUITER"
        hasDirectReports={false}
        shortcuts={HOME_SHORTCUTS.RECRUITER}
      />,
    );

    expect(screen.getByText("Reclutador")).toBeInTheDocument();
    expect(screen.getByText("Procesos de selección activos")).toBeInTheDocument();
    expect(screen.queryByText("Candidatos")).not.toBeInTheDocument();
    expect(screen.queryByText("Apariencia")).not.toBeInTheDocument();
  });

  it("shows administrator feed and grouped configuration", () => {
    render(
      <CompanyHome
        firstName="Sofía"
        companyName="Acme"
        companySlug="acme"
        homeRole="CLIENT_ADMIN"
        hasDirectReports={false}
        shortcuts={HOME_SHORTCUTS.CLIENT_ADMIN}
      />,
    );

    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Compañía activa")).toBeInTheDocument();
    expect(screen.getByText("Procesos de selección activos")).toBeInTheDocument();
    expect(screen.getByText("Configuración de organización")).toBeInTheDocument();
    expect(screen.getByText("Configuración del ATS")).toBeInTheDocument();
    expect(screen.getByText("Configuración de performance")).toBeInTheDocument();
    expect(screen.getByText("Configuración del sistema")).toBeInTheDocument();
    expect(screen.getByText("Colaboradores")).toBeInTheDocument();
    expect(screen.getByText("Apariencia")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline")).not.toBeInTheDocument();
    expect(screen.queryByText("Próximamente")).not.toBeInTheDocument();
  });
});
