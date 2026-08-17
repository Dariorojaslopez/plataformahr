import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EmployeeForm } from "@/components/organization/employee-form";
import type { Area, Position } from "@/types/organization";

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

const now = new Date().toISOString();

const areaWithoutBu: Area = {
  id: "area-no-bu",
  companyId: "c1",
  name: "Talento",
  code: null,
  description: null,
  businessUnitId: null,
  parentAreaId: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const areaWithBu: Area = {
  ...areaWithoutBu,
  id: "area-with-bu",
  name: "Comercial",
  businessUnitId: "bu-1",
};

const position: Position = {
  id: "pos-1",
  companyId: "c1",
  areaId: areaWithoutBu.id,
  jobLevelId: null,
  name: "Analista",
  code: null,
  mission: null,
  responsibilities: null,
  requiredExperience: null,
  requiredEducation: null,
  headcount: 1,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe("EmployeeForm area selector", () => {
  it("lists areas that have no business unit", async () => {
    const user = userEvent.setup();
    render(
      <EmployeeForm
        areas={[areaWithoutBu, areaWithBu]}
        positions={[position]}
        businessUnits={[]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Unidad de negocio")).not.toBeInTheDocument();

    const trigger = document.getElementById("emp-area");
    expect(trigger).toBeTruthy();
    await user.click(trigger!);

    expect(
      await screen.findByRole("option", { name: "Talento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Comercial" }),
    ).toBeInTheDocument();
  });
});
