import { describe, expect, it } from "vitest";
import {
  emptyCargoOccupantRow,
  occupantNeedsSelection,
  occupantLabel,
  toPositionOccupantPayload,
} from "./position-occupant";

describe("position occupant helpers", () => {
  it("shows the occupant dropdown only when the cargo has more than one person", () => {
    expect(
      occupantNeedsSelection([{ id: "1", firstName: "Ana", lastName: "Pérez" }]),
    ).toBe(false);
    expect(
      occupantNeedsSelection([
        { id: "1", firstName: "Ana", lastName: "Pérez" },
        { id: "2", firstName: "Luis", lastName: "Gómez" },
      ]),
    ).toBe(true);
  });

  it("builds the save payload from selected cargos", () => {
    const row = emptyCargoOccupantRow();
    expect(toPositionOccupantPayload([{ ...row, positionId: "" }])).toEqual([]);
    expect(
      toPositionOccupantPayload([
        { ...row, positionId: "pos-1", occupantId: "emp-1" },
      ]),
    ).toEqual([{ positionId: "pos-1", employeeId: "emp-1" }]);
  });

  it("formats occupant names", () => {
    expect(occupantLabel({ id: "1", firstName: "Ana", lastName: "Pérez" })).toBe(
      "Ana Pérez",
    );
  });
});
