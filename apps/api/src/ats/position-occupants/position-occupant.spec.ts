import { POSITION_OCCUPANT_ERRORS } from '../ats.constants';
import {
  occupantNeedsSelection,
  OccupantResolutionError,
  pickOccupant,
} from './position-occupant';

const ana = {
  id: 'emp-1',
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  userId: 'user-1',
};
const luis = {
  id: 'emp-2',
  firstName: 'Luis',
  lastName: 'Gómez',
  email: 'luis@example.com',
  userId: 'user-2',
};

describe('pickOccupant', () => {
  it('uses the only occupant when none is selected', () => {
    expect(pickOccupant([ana])).toEqual(ana);
    expect(occupantNeedsSelection([ana])).toBe(false);
  });

  it('requires an occupant name when the cargo has more than one', () => {
    expect(occupantNeedsSelection([ana, luis])).toBe(true);
    expect(() => pickOccupant([ana, luis])).toThrow(OccupantResolutionError);
    expect(() => pickOccupant([ana, luis])).toThrow(
      POSITION_OCCUPANT_ERRORS.SELECT_OCCUPANT,
    );
  });

  it('accepts an occupant that belongs to the cargo', () => {
    expect(pickOccupant([ana, luis], 'emp-2')).toEqual(luis);
  });

  it('rejects an occupant outside the cargo', () => {
    expect(() => pickOccupant([ana], 'emp-2')).toThrow(
      POSITION_OCCUPANT_ERRORS.OCCUPANT_NOT_IN_POSITION,
    );
  });

  it('rejects a cargo without eligible occupants', () => {
    expect(() => pickOccupant([])).toThrow(
      POSITION_OCCUPANT_ERRORS.NO_OCCUPANTS,
    );
  });
});
