import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AreaForm,
  NO_BUSINESS_UNIT_LABEL,
  areaToForm,
  emptyAreaForm,
  toCreateAreaPayload,
  toUpdateAreaPayload,
} from "@/components/organization/area-form";
import type { Area } from "@/types/organization";

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
const sampleArea: Area = {
  id: "area-1",
  companyId: "c1",
  name: "Operaciones",
  code: "OPS",
  description: null,
  businessUnitId: null,
  parentAreaId: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe("area form payloads", () => {
  it("omits businessUnitId on create when empty and never sends a fake id", () => {
    const values = { ...emptyAreaForm(), name: "Operaciones" };
    const payload = toCreateAreaPayload(values);
    const json = JSON.stringify(payload);
    expect(payload.businessUnitId).toBeUndefined();
    expect(json).not.toContain("none");
    expect(json).not.toContain("__none__");
    expect(json).not.toContain("businessUnitId");
  });

  it("includes a real businessUnitId on create when selected", () => {
    const values = {
      ...emptyAreaForm(),
      name: "Operaciones",
      businessUnitId: "11111111-1111-4111-8111-111111111111",
    };
    expect(toCreateAreaPayload(values).businessUnitId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("sends null on update to clear the business unit", () => {
    const values = areaToForm(sampleArea);
    expect(values.businessUnitId).toBe("");
    const payload = toUpdateAreaPayload(values);
    expect(payload.businessUnitId).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("none");
    expect(JSON.stringify(payload)).not.toContain("__none__");
  });

  it("maps an existing business unit into the update payload", () => {
    const values = areaToForm({
      ...sampleArea,
      businessUnitId: "11111111-1111-4111-8111-111111111111",
    });
    expect(toUpdateAreaPayload(values).businessUnitId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("AreaForm business unit field", () => {
  it("marks unidad de negocio as optional and offers a clear empty option", async () => {
    const user = userEvent.setup();
    render(
      <AreaForm
        values={emptyAreaForm()}
        onChange={vi.fn()}
        businessUnits={[{ id: "bu-1", name: "Comercial" }]}
        parentOptions={[]}
      />,
    );

    expect(screen.getByText("Unidad de negocio")).toBeInTheDocument();
    expect(screen.queryByText("Unidad de negocio *")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Opcional. La compañía puede organizar áreas sin unidades de negocio.",
      ),
    ).toBeInTheDocument();

    const trigger = document.getElementById("area-bu");
    expect(trigger).toBeTruthy();
    expect(trigger).not.toHaveAttribute("aria-required", "true");
    await user.click(trigger!);

    expect(
      await screen.findByRole("option", { name: NO_BUSINESS_UNIT_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Comercial" }),
    ).toBeInTheDocument();
  });
});
