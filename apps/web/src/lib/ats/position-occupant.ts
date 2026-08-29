export type OccupantOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export function occupantNeedsSelection(occupants: OccupantOption[]): boolean {
  return occupants.length > 1;
}

export function occupantLabel(occupant: OccupantOption): string {
  return `${occupant.firstName} ${occupant.lastName}`.trim();
}

export type CargoOccupantRow = {
  key: string;
  positionId: string;
  occupantId: string;
  locked?: boolean;
  positionName?: string;
  occupantName?: string;
  legacySummary?: string;
};

export function emptyCargoOccupantRow(): CargoOccupantRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    positionId: "",
    occupantId: "",
  };
}

export function toPositionOccupantPayload(rows: CargoOccupantRow[]) {
  return rows
    .filter((row) => row.positionId)
    .map((row) => ({
      positionId: row.positionId,
      employeeId: row.occupantId || undefined,
    }));
}
