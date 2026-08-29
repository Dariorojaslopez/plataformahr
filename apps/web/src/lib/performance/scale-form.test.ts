import { describe, expect, it } from "vitest";
import {
  emptyScaleForm,
  toCreateScalePayload,
  withKind,
} from "@/lib/performance/scale-form";
import { formatOptionsForKind, scaleTypeLabel } from "@/lib/performance/scale-format";

describe("scale form payloads", () => {
  it("sends qualitative numeric min/max", () => {
    expect(
      toCreateScalePayload({
        ...emptyScaleForm(),
        name: "Desempeño",
        minValue: "1",
        maxValue: "5",
      }),
    ).toEqual({
      name: "Desempeño",
      description: undefined,
      status: "ACTIVE",
      kind: "QUALITATIVE",
      format: "NUMERIC",
      minValue: 1,
      maxValue: 5,
      likertIcon: undefined,
    });
  });

  it("sends descriptive labels without a numeric range", () => {
    const values = emptyScaleForm();
    values.format = "DESCRIPTIVE";
    values.descriptiveLabels = ["Bajo", "Medio", "Alto", "", ""];
    expect(toCreateScalePayload(values)).toEqual({
      name: "",
      description: undefined,
      status: "ACTIVE",
      kind: "QUALITATIVE",
      format: "DESCRIPTIVE",
      descriptiveLabels: ["Bajo", "Medio", "Alto", "", ""],
    });
  });

  it("switches quantitative defaults to percentage 1–120", () => {
    const next = withKind(emptyScaleForm(), "QUANTITATIVE");
    expect(next.format).toBe("PERCENTAGE");
    expect(next.maxValue).toBe("120");
    expect(formatOptionsForKind("QUANTITATIVE").map((item) => item.value)).toEqual(
      ["PERCENTAGE", "CURRENCY", "NUMERIC"],
    );
    expect(scaleTypeLabel("QUALITATIVE", "LIKERT")).toBe("Cualitativa · Likert");
  });
});
