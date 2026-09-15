import { describe, expect, it } from "vitest";
import {
  formatBooleanScreeningAnswer,
  formatScreeningChoiceLabels,
  toggleMultipleChoiceSelection,
} from "@/lib/ats/screening";

const options = [
  { id: "a", label: "Disponibilidad" },
  { id: "b", label: "Viajes" },
  { id: "all", label: "Todas las anteriores", isAllOfTheAbove: true },
];

describe("toggleMultipleChoiceSelection", () => {
  it("selects every previous option when choosing all of the above", () => {
    expect(toggleMultipleChoiceSelection([], "all", options)).toEqual([
      "a",
      "b",
      "all",
    ]);
  });

  it("clears all of the above if one previous option is unchecked", () => {
    expect(
      toggleMultipleChoiceSelection(["a", "b", "all"], "b", options),
    ).toEqual(["a"]);
  });

  it("checks all of the above when every previous option is selected", () => {
    expect(toggleMultipleChoiceSelection(["a"], "b", options)).toEqual([
      "a",
      "b",
      "all",
    ]);
  });
});

describe("screening answer labels", () => {
  it("formats true/false answers", () => {
    expect(formatBooleanScreeningAnswer("TRUE_FALSE", true)).toBe("Verdadero");
    expect(formatBooleanScreeningAnswer("YES_NO", false)).toBe("No");
  });

  it("formats selected choice labels with letters", () => {
    expect(formatScreeningChoiceLabels(options, ["b", "all"])).toBe(
      "B. Viajes, C. Todas las anteriores",
    );
  });
});
