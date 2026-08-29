import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformBillingSection } from "@/components/platform/platform-billing-section";

const getBilling = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  platformBillingRequest: () => getBilling(),
  updateManagedCompanyBillingRequest: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

describe("PlatformBillingSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows calculated charge, net profit and the consolidated total", async () => {
    getBilling.mockResolvedValue({
      items: [
        {
          companyId: "c1",
          companyName: "Acme",
          taxAmount: "19000.00",
          licenseAmount: "50000.00",
          subscriptionAmount: "31000.00",
          marginPercent: "20.00",
          costTotal: "100000.00",
          chargedAmount: "120000.00",
          netProfit: "20000.00",
        },
      ],
      totals: {
        costTotal: "100000.00",
        chargedAmount: "120000.00",
        netProfit: "20000.00",
      },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PlatformBillingSection />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("20.00%")).toBeInTheDocument();
    expect(screen.getByText("Consolidado")).toBeInTheDocument();
    expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0);
  });
});
