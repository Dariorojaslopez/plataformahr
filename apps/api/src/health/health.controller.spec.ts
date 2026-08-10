import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let queryRawUnsafe: jest.Mock;

  beforeEach(async () => {
    queryRawUnsafe = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRawUnsafe: queryRawUnsafe },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('liveness returns status ok without touching DB', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
    expect(queryRawUnsafe.mock.calls).toHaveLength(0);
  });

  it('readiness returns ready when DB responds', async () => {
    queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    const status = jest.fn();
    const res = { status } as unknown as import('express').Response;
    await expect(controller.getReady(res)).resolves.toEqual({
      status: 'ready',
    });
    expect(status.mock.calls).toHaveLength(0);
  });

  it('readiness returns 503 when DB fails', async () => {
    queryRawUnsafe.mockRejectedValue(new Error('db down'));
    const status = jest.fn();
    const res = { status } as unknown as import('express').Response;
    await expect(controller.getReady(res)).resolves.toEqual({
      status: 'not_ready',
    });
    expect(status.mock.calls).toEqual([[503]]);
  });
});
