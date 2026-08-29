import { POSITION_OCCUPANT_ERRORS } from '../ats.constants';

export type OccupantCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userId: string | null;
};

export function occupantNeedsSelection(
  occupants: OccupantCandidate[],
): boolean {
  return occupants.length > 1;
}

export function pickOccupant(
  occupants: OccupantCandidate[],
  employeeId?: string | null,
): OccupantCandidate {
  if (occupants.length === 0) {
    throw new OccupantResolutionError(POSITION_OCCUPANT_ERRORS.NO_OCCUPANTS);
  }
  if (employeeId) {
    const match = occupants.find((item) => item.id === employeeId);
    if (!match) {
      throw new OccupantResolutionError(
        POSITION_OCCUPANT_ERRORS.OCCUPANT_NOT_IN_POSITION,
      );
    }
    return match;
  }
  if (occupants.length > 1) {
    throw new OccupantResolutionError(POSITION_OCCUPANT_ERRORS.SELECT_OCCUPANT);
  }
  return occupants[0];
}

export class OccupantResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OccupantResolutionError';
  }
}
