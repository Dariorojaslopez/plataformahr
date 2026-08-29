import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadRequestException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CompanyHomeMediaKind } from '@prisma/client';
import { HOME_COMPANY_INFO_AUDIT } from './home-info.constants';
import { HomeInfoService } from './home-info.service';

const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const tenant = {
  userId: 'user-1',
  companyId: '11111111-1111-4111-8111-111111111111',
  membershipId: 'membership-1',
  viaPlatformOwner: false,
};

const liveRow = {
  id: 'info-1',
  companyId: tenant.companyId,
  title: 'Nuestra cultura',
  description: 'Video de bienvenida',
  publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  unpublishedAt: new Date('2027-01-01T00:00:00.000Z'),
  mediaKind: CompanyHomeMediaKind.IMAGE,
  fileName: `info-${tenant.companyId}.png`,
  mimeType: 'image/png',
  mediaUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('HomeInfoService', () => {
  let uploadsDir: string;
  let previousUploads: string | undefined;

  beforeEach(() => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'home-info-service-'));
    previousUploads = process.env.COMPANY_UPLOADS_DIR;
    process.env.COMPANY_UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    if (previousUploads === undefined) delete process.env.COMPANY_UPLOADS_DIR;
    else process.env.COMPANY_UPLOADS_DIR = previousUploads;
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  function build(overrides?: {
    row?: typeof liveRow | null;
    permissions?: string[];
  }) {
    const row = overrides?.row === undefined ? liveRow : overrides.row;
    const prisma = {
      companyHomeInfo: {
        findUnique: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...liveRow,
            ...data,
            id: 'info-new',
            unpublishedAt: data.unpublishedAt ?? null,
            mediaKind: data.mediaKind ?? null,
            fileName: data.fileName ?? null,
            mimeType: data.mimeType ?? null,
            mediaUpdatedAt: data.mediaUpdatedAt ?? null,
          }),
        ),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...liveRow, ...data }),
          ),
      },
    };
    const rbac = {
      getPermissionCodesForMembership: jest
        .fn()
        .mockResolvedValue(new Set(overrides?.permissions ?? ['company.read'])),
    };
    const audit = { create: jest.fn().mockResolvedValue({}) };
    const service = new HomeInfoService(
      prisma as never,
      rbac as never,
      audit as never,
    );
    return { service, prisma, audit };
  }

  it('hides unpublished content from readers', async () => {
    const future = {
      ...liveRow,
      publishedAt: new Date('2099-01-01T00:00:00.000Z'),
      unpublishedAt: null,
    };
    const { service } = build({ row: future, permissions: ['company.read'] });
    const result = await service.getCompanyInfo(tenant);
    expect(result.isLive).toBe(false);
    expect(result.title).toBe('');
  });

  it('returns unpublished content to company managers', async () => {
    const future = {
      ...liveRow,
      publishedAt: new Date('2099-01-01T00:00:00.000Z'),
      unpublishedAt: null,
    };
    const { service } = build({
      row: future,
      permissions: ['company.read', 'company.manage'],
    });
    const result = await service.getCompanyInfo(tenant);
    expect(result.title).toBe('Nuestra cultura');
    expect(result.isLive).toBe(false);
    expect(result.hasMedia).toBe(true);
  });

  it('rejects an unpublication date before publication', async () => {
    const { service } = build({
      permissions: ['company.read', 'company.manage'],
    });
    await expect(
      service.updateCompanyInfo(tenant, {
        title: 'Hola',
        publishedAt: '2026-08-10T00:00:00.000Z',
        unpublishedAt: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SVG uploads with 415', async () => {
    const { service } = build({
      permissions: ['company.read', 'company.manage'],
    });
    await expect(
      service.replaceMedia(tenant, {
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('writes a PNG and records audit without leaking the path', async () => {
    const { service, audit } = build({
      row: null,
      permissions: ['company.read', 'company.manage'],
    });
    const result = await service.replaceMedia(tenant, { buffer: MIN_PNG });
    expect(result.hasMedia).toBe(true);
    expect(result.mediaKind).toBe('IMAGE');
    expect(JSON.stringify(result)).not.toMatch(/\/tmp\/|uploads|fileName/);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: HOME_COMPANY_INFO_AUDIT.MEDIA_REPLACED,
      }),
    );
  });

  it('does not stream unpublished media to readers', async () => {
    const future = {
      ...liveRow,
      publishedAt: new Date('2099-01-01T00:00:00.000Z'),
      unpublishedAt: null,
    };
    const { service } = build({ row: future, permissions: ['company.read'] });
    await expect(service.readMedia(tenant)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
