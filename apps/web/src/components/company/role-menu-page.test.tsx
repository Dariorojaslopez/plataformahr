import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RoleMenuPageClient } from "@/components/company/role-menu-page";
import { companyApi } from "@/lib/api/company";

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

vi.mock("@/components/auth/session-provider", () => ({
  useSession: () => ({ refreshCompanyAccess: vi.fn() }),
}));

vi.mock("@/lib/api/company", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/company")>(
    "@/lib/api/company",
  );
  return {
    ...actual,
    companyApi: {
      ...actual.companyApi,
      getRoleMenus: vi.fn(),
      updateRoleMenus: vi.fn(),
    },
  };
});

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
});

afterEach(() => {
  cleanup();
});

describe("RoleMenuPageClient", () => {
  it("lets an admin pick menus per role", async () => {
    vi.mocked(companyApi.getRoleMenus).mockResolvedValue({
      catalog: [
        {
          section: "Organización",
          href: "/organization/org-chart",
          label: "Organigrama",
        },
        {
          section: "ATS",
          href: "/ats/vacancy-requests",
          label: "Crear proceso de selección",
        },
      ],
      roles: [
        {
          roleCode: "RECRUITER",
          hrefs: ["/ats/vacancy-requests"],
          customized: false,
        },
        {
          roleCode: "PERFORMANCE_MANAGER",
          hrefs: [],
          customized: false,
        },
        {
          roleCode: "LEADER",
          hrefs: ["/organization/org-chart"],
          customized: false,
        },
        {
          roleCode: "COLLABORATOR",
          hrefs: ["/ats/vacancy-requests"],
          customized: false,
        },
      ],
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RoleMenuPageClient />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Permisos de menú" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Líder" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Administrador" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Líder de reclutamiento" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Líder" }));
    expect(
      await screen.findByLabelText("Organigrama"),
    ).toBeInTheDocument();
  });
});
