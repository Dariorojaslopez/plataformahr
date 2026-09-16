import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/layout/app-header";

const { push, session } = vi.hoisted(() => ({
  push: vi.fn(),
  session: {
    user: {
      id: "user-1",
      email: "oscar@example.com",
      firstName: "Oscar",
      lastName: "Julián",
      isPlatformOwner: true,
      mustChangePassword: false,
    },
    companies: [
      { id: "co-1", name: "Plataforma HR", slug: "plataforma-hr" },
    ],
    activeCompany: {
      id: "co-1",
      name: "Plataforma HR",
      slug: "plataforma-hr",
    },
    selectCompany: vi.fn(),
    refreshCompanyAccess: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push, replace: vi.fn() }),
}));

vi.mock("@/components/theme/theme-provider", () => ({
  ThemeToggleButton: () => null,
}));

vi.mock("@/components/auth/session-provider", () => ({
  useSession: () => session,
}));

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("AppHeader platform owner", () => {
  it("links back to all companies from the company switcher even with one tenant", async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole("button", { name: /Plataforma HR/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Todas las compañías" }),
    );

    expect(push).toHaveBeenCalledWith("/platform");
  });
});
