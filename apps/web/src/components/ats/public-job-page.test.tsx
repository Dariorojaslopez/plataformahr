import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PublicJobPage } from "@/components/ats/public-job-page";

vi.mock("@/lib/api/ats", () => ({
  publicJobsApi: {
    get: vi.fn().mockResolvedValue({
      publicId: "PublicJobId00001",
      title: "Desarrollador",
      description: "Construye productos.",
      areaName: "Tecnología",
      companyName: "Acme",
      brandPrimaryColor: "#123456",
      hasLogo: false,
      publishedAt: new Date().toISOString(),
    }),
    apply: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

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
    expect(screen.getByRole("heading", { name: "Postúlate" }))
      .toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico *")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
