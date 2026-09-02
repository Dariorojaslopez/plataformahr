import { BadRequestException } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { POSITION_OCCUPANT_ERRORS } from '../ats.constants';
import { PositionOccupantsService } from './position-occupants.service';

describe('PositionOccupantsService', () => {
  const companyId = 'c1';
  const positionId = 'p1';
  const occupant = {
    id: 'e1',
    firstName: 'María',
    lastName: 'López',
    email: 'maria@example.com',
    userId: null,
  };

  function serviceWith(employees: typeof occupant[]) {
    return new PositionOccupantsService(
      {
        employee: {
          findMany: jest.fn().mockResolvedValue(employees),
        },
      } as never,
      {
        requirePosition: jest.fn().mockResolvedValue({ id: positionId }),
      } as never,
    );
  }

  it('lists active collaborators in the cargo even without a login user', async () => {
    const service = serviceWith([occupant]);
    await expect(service.list(companyId, positionId)).resolves.toEqual([
      occupant,
    ]);
  });

  it('resolves the unique occupant without requiring a user account', async () => {
    const service = serviceWith([occupant]);
    await expect(
      service.resolve(companyId, positionId),
    ).resolves.toEqual(occupant);
  });

  it('rejects a cargo with no active collaborators', async () => {
    const service = serviceWith([]);
    await expect(service.resolve(companyId, positionId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.resolve(companyId, positionId)).rejects.toThrow(
      POSITION_OCCUPANT_ERRORS.NO_OCCUPANTS,
    );
  });

  it('only loads ACTIVE employees of that cargo', async () => {
    const findMany = jest.fn().mockResolvedValue([occupant]);
    const service = new PositionOccupantsService(
      { employee: { findMany } } as never,
      { requirePosition: jest.fn().mockResolvedValue({ id: positionId }) } as never,
    );
    await service.list(companyId, positionId);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId,
          positionId,
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
      }),
    );
  });
});
