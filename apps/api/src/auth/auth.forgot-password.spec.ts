/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService.forgotPassword', () => {
  function build(overrides?: {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      status: UserStatus;
      deletedAt: Date | null;
      passwordHash: string | null;
      mustChangePassword: boolean;
      isPlatformOwner: boolean;
    } | null;
    mailStatus?: 'SENT' | 'SKIPPED' | 'FAILED';
  }) {
    const user =
      overrides?.user === undefined
        ? {
            id: 'user-1',
            email: 'ana@acme.test',
            firstName: 'Ana',
            lastName: 'Pérez',
            status: UserStatus.ACTIVE,
            deletedAt: null,
            passwordHash: 'hash-old',
            mustChangePassword: false,
            isPlatformOwner: false,
          }
        : overrides.user;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      userSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const passwordHashing = {
      hash: jest.fn().mockResolvedValue('hash-new'),
      verify: jest.fn(),
    };
    const tokens = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      refreshTtlMs: 1000,
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const mail = {
      sendText: jest.fn().mockResolvedValue({
        status: overrides?.mailStatus ?? 'SENT',
      }),
    };

    const service = new AuthService(
      prisma as never,
      passwordHashing as never,
      tokens as never,
      audit as never,
      mail as never,
    );

    return { service, prisma, passwordHashing, audit, mail };
  }

  it('returns ok without revealing missing accounts', async () => {
    const { service, prisma, mail } = build({ user: null });
    await expect(service.forgotPassword('missing@acme.test')).resolves.toEqual({
      ok: true,
    });
    expect(mail.sendText).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('emails a temporary password and forces mustChangePassword', async () => {
    const { service, prisma, passwordHashing, mail, audit } = build();
    await expect(service.forgotPassword('Ana@Acme.Test')).resolves.toEqual({
      ok: true,
    });
    expect(passwordHashing.hash).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'hash-new', mustChangePassword: true },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalled();
    expect(mail.sendText).toHaveBeenCalled();
    expect(mail.sendText.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        to: 'ana@acme.test',
        subject: expect.stringMatching(/contraseña/i),
        text: expect.stringMatching(/contraseña temporal/i),
      }),
    );
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { delivered: true },
      }),
    );
  });

  it('rolls back the password when mail is not sent', async () => {
    const { service, prisma, audit } = build({ mailStatus: 'SKIPPED' });
    await expect(service.forgotPassword('ana@acme.test')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: 'hash-old',
        mustChangePassword: false,
      },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ delivered: false }),
      }),
    );
  });
});
