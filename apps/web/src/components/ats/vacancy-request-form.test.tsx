import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { VacancyRequestForm } from "@/components/ats/vacancy-request-form";
import { VACANCY_REQUESTER_MESSAGES } from "@/lib/ats/vacancy-requester";

vi.mock("@/hooks/use-company-id", () => ({
  useCompanyId: () => "company-1",
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
});

const baseProps: ComponentProps<typeof VacancyRequestForm> = {
  values: {
    type: "EXISTING_POSITION",
    requestedByEmployeeId: "",
    existingPositionId: "pos-1",
    requestedPositionName: "",
    requestedAreaId: "",
    requestedJobLevelId: "",
    requestedHeadcount: "1",
    justification: "Need coverage",
    approvalSteps: [],
  },
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  positions: [{ value: "pos-1", label: "Dev" }],
  areas: [],
  jobLevels: [],
  employees: [{ value: "emp-1", label: "Ana Ruiz" }],
  linkedEmployeeExists: true,
  canProxyRequester: true,
};

async function openRequesterSelect() {
  const user = userEvent.setup();
  const trigger = document.getElementById("vr-requester");
  expect(trigger).toBeTruthy();
  await user.click(trigger!);
  return user;
}

function renderForm(
  props: Partial<ComponentProps<typeof VacancyRequestForm>> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VacancyRequestForm {...baseProps} {...props} />
    </QueryClientProvider>,
  );
}

describe("VacancyRequestForm requester field", () => {
  it("offers Yo when the user has a linked employee", async () => {
    renderForm({
      linkedEmployeeExists: true,
      canProxyRequester: true,
    });
    expect(document.getElementById("vr-requester")).toHaveAttribute(
      "aria-required",
      "false",
    );
    await openRequesterSelect();
    expect(await screen.findByRole("option", { name: "Yo" })).toBeInTheDocument();
    expect(
      screen.queryByText(VACANCY_REQUESTER_MESSAGES.noLinkedEmployee),
    ).not.toBeInTheDocument();
  });

  it("does not offer Yo and requires a collaborator when none is linked", async () => {
    renderForm({
      linkedEmployeeExists: false,
      canProxyRequester: true,
    });
    const trigger = document.getElementById("vr-requester");
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === "LABEL" && node.textContent === "Solicitante *",
      ),
    ).toBeInTheDocument();
    await openRequesterSelect();
    expect(screen.queryByRole("option", { name: "Yo" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Ana Ruiz" }),
    ).toBeInTheDocument();
  });

  it("shows approval levels and hides the general manager checkbox", () => {
    renderForm({
      linkedEmployeeExists: true,
      canProxyRequester: true,
    });
    expect(screen.getByText("Niveles de aprobación")).toBeInTheDocument();
    expect(
      screen.queryByText("Requiere aprobación de Gerencia General"),
    ).not.toBeInTheDocument();
  });

  it("blocks submit and explains when there is no linked employee and no proxy", () => {
    renderForm({
      linkedEmployeeExists: false,
      canProxyRequester: false,
    });
    expect(
      screen.getByText(VACANCY_REQUESTER_MESSAGES.noLinkedEmployee),
    ).toBeInTheDocument();
    expect(document.getElementById("vr-requester")).toBeNull();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
