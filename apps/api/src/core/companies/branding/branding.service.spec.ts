import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrandingService } from './branding.service';
import { COMPANY_BRANDING_AUDIT } from './branding.constants';

const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('BrandingService', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  let uploadsDir: string;
  let previousUploads: string | undefined;

  beforeEach(() => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'branding-service-'));
    previousUploads = process.env.COMPANY_UPLOADS_DIR;
    process.env.COMPANY_UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    if (previousUploads === undefined) delete process.env.COMPANY_UPLOADS_DIR;
    else process.env.COMPANY_UPLOADS_DIR = previousUploads;
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('returns null branding fields as presentation defaults', async () => {
    const company = {
      id: companyId,
      name: 'Acme',
      legalName: 'Acme S.A.',
      slug: 'acme',
      brandPrimaryColor: null,
      logoFileName: null,
      logoMimeType: null,
      logoUpdatedAt: null,
    };
    const service = new BrandingService(
      { company: { findFirst: jest.fn().mockResolvedValue(company) } } as never,
      { create: jest.fn() } as never,
    );
    const result = await service.getBranding(companyId);
    expect(result.brandPrimaryColor).toBeNull();
    expect(result.hasLogo).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/logoFileName|\/data\/|uploads/);
  });

  it('normalizes a valid color and writes audit metadata without file bytes', async () => {
    const company = {
      id: companyId,
      name: 'Acme',
      legalName: null,
      slug: 'acme',
      brandPrimaryColor: null,
      logoFileName: null,
      logoMimeType: null,
      logoUpdatedAt: null,
    };
    const updated = { ...company, brandPrimaryColor: '#112233' };
    const create = jest.fn().mockResolvedValue({});
    const service = new BrandingService(
      {
        company: {
          findFirst: jest.fn().mockResolvedValue(company),
          update: jest.fn().mockResolvedValue(updated),
        },
      } as never,
      { create } as never,
    );

    const result = await service.updateBranding(companyId, userId, {
      brandPrimaryColor: '#112233',
    });
    expect(result.brandPrimaryColor).toBe('#112233');
    const auditCall = (
      create.mock.calls as unknown as Array<
        [{ action: string; metadata: Record<string, unknown> }]
      >
    )[0][0];
    expect(auditCall.action).toBe(COMPANY_BRANDING_AUDIT.UPDATED);
    expect(auditCall.metadata).not.toHaveProperty('bytes');
    expect(auditCall.metadata).not.toHaveProperty('buffer');
  });

  it('rejects an invalid color', async () => {
    const service = new BrandingService(
      {
        company: {
          findFirst: jest.fn().mockResolvedValue({
            id: companyId,
            name: 'Acme',
            legalName: null,
            slug: 'acme',
            brandPrimaryColor: null,
            logoFileName: null,
            logoMimeType: null,
            logoUpdatedAt: null,
          }),
        },
      } as never,
      { create: jest.fn() } as never,
    );
    await expect(
      service.updateBranding(companyId, userId, {
        brandPrimaryColor: 'url(#x)',
      }),
    ).rejects.toThrow(/hex color/);
  });

  it('stores a valid PNG under the configured uploads directory', async () => {
    const company = {
      id: companyId,
      name: 'Acme',
      legalName: null,
      slug: 'acme',
      brandPrimaryColor: null,
      logoFileName: null,
      logoMimeType: null,
      logoUpdatedAt: null,
    };
    const update = jest.fn().mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({
        ...company,
        ...data,
        logoUpdatedAt: new Date('2026-08-17T00:00:00.000Z'),
      }),
    );
    const service = new BrandingService(
      {
        company: {
          findFirst: jest.fn().mockResolvedValue(company),
          update,
        },
      } as never,
      { create: jest.fn().mockResolvedValue({}) } as never,
    );

    const result = await service.replaceLogo(companyId, userId, {
      buffer: MIN_PNG,
    });
    expect(result.hasLogo).toBe(true);
    const updateArg = (
      update.mock.calls as unknown as Array<
        [{ data: { logoFileName: string; logoMimeType: string } }]
      >
    )[0][0];
    expect(updateArg.data.logoMimeType).toBe('image/png');
    expect(updateArg.data.logoFileName).toMatch(/\.png$/);
    expect(updateArg.data.logoFileName).not.toContain('..');
  });
});
