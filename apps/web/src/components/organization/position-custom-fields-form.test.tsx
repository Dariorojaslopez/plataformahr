import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PositionCustomFieldsForm } from "@/components/organization/position-custom-fields-form";
import {
  customFieldValuesFromPosition,
  emptyCustomFieldValues,
  formatCustomFieldDisplay,
  slugFromLabel,
  toCustomFieldsPayload,
} from "@/components/organization/position-custom-fields";
import type {
  Position,
  PositionCustomFieldDefinition,
} from "@/types/organization";

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

function definition(
  partial: Partial<PositionCustomFieldDefinition> &
    Pick<PositionCustomFieldDefinition, "id" | "key" | "label" | "type">,
): PositionCustomFieldDefinition {
  return {
    companyId: "c1",
    required: false,
    active: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    options: [],
    _count: { values: 0 },
    ...partial,
  };
}

const definitions: PositionCustomFieldDefinition[] = [
  definition({ id: "d-text", key: "codigo_sap", label: "Código SAP", type: "TEXT" }),
  definition({
    id: "d-number",
    key: "headcount_extra",
    label: "Plazas extra",
    type: "NUMBER",
  }),
  definition({
    id: "d-bool",
    key: "requiere_licencia",
    label: "Requiere licencia",
    type: "BOOLEAN",
  }),
  definition({
    id: "d-date",
    key: "vigencia",
    label: "Vigencia",
    type: "DATE",
  }),
  definition({
    id: "d-select",
    key: "familia",
    label: "Familia de cargo",
    type: "SELECT",
    options: [
      {
        id: "opt-1",
        companyId: "c1",
        definitionId: "d-select",
        label: "Operaciones",
        sortOrder: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }),
];

describe("position custom field payloads", () => {
  it("maps each type into the API payload", () => {
    const values = {
      "d-text": "SAP-1",
      "d-number": "3",
      "d-bool": true,
      "d-date": "2026-08-17",
      "d-select": "opt-1",
    };
    expect(toCustomFieldsPayload(definitions, values)).toEqual(
      expect.arrayContaining([
        { definitionId: "d-text", value: "SAP-1" },
        { definitionId: "d-number", value: 3 },
        { definitionId: "d-bool", value: true },
        { definitionId: "d-date", value: "2026-08-17" },
        { definitionId: "d-select", value: "opt-1" },
      ]),
    );
    expect(toCustomFieldsPayload(definitions, values)).toHaveLength(5);
  });

  it("prefills from a stored position without showing technical keys", () => {
    const position: Position = {
      id: "p1",
      companyId: "c1",
      areaId: "a1",
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
      customFields: [
        {
          definitionId: "d-text",
          key: "codigo_sap",
          label: "Código SAP",
          type: "TEXT",
          required: false,
          active: true,
          value: "SAP-9",
          optionId: null,
          optionLabel: null,
        },
      ],
    };
    const values = customFieldValuesFromPosition(definitions, position);
    expect(values["d-text"]).toBe("SAP-9");
    expect(emptyCustomFieldValues(definitions)["d-bool"]).toBe(false);
    expect(formatCustomFieldDisplay({ type: "BOOLEAN", value: true, optionLabel: null })).toBe(
      "Sí",
    );
    expect(slugFromLabel("Centro de costo")).toBe("centro_de_costo");
  });
});

describe("PositionCustomFieldsForm", () => {
  it("renders controls for TEXT NUMBER BOOLEAN DATE and SELECT", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PositionCustomFieldsForm
        definitions={definitions}
        values={emptyCustomFieldValues(definitions)}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Código SAP")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Plazas extra")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Vigencia")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Requiere licencia")).toBeInTheDocument();
    expect(screen.getByText("Familia de cargo")).toBeInTheDocument();
    expect(screen.queryByText("codigo_sap")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Código SAP"), "X");
    expect(onChange).toHaveBeenCalled();
  });
});
