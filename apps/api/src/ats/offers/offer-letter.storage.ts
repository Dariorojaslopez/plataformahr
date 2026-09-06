import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { COMPANY_ID_PATTERN } from '../../core/companies/branding/branding.constants';
import { resolveCompanyUploadsDir } from '../../core/companies/branding/branding.storage';
import {
  OFFER_LETTER_EXTENSION_BY_MIME,
  OFFER_SIGNED_FILE_NAME_PATTERN,
  type AllowedOfferLetterMime,
} from './offer-letter.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for offer letter storage');
  }
}

export function assertSafeOfferSignedFileName(fileName: string): void {
  if (!OFFER_SIGNED_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid signed offer letter file name');
  }
}

export function buildOfferSignedFileName(
  mime: AllowedOfferLetterMime,
  id: string = crypto.randomUUID(),
): string {
  return `offer-signed-${id}.${OFFER_LETTER_EXTENSION_BY_MIME[mime]}`;
}

export function resolveOfferSignedAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeOfferSignedFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected offer letter path');
  }
  return absolute;
}

export async function writeOfferSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveOfferSignedAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  await mkdir(resolve(options.uploadsDir, options.companyId), {
    recursive: true,
  });
  await writeFile(absolute, options.buffer);
  return absolute;
}

export async function readOfferSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveOfferSignedAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteOfferSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveOfferSignedAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  try {
    await unlink(absolute);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code: string }).code
        : '';
    if (code !== 'ENOENT') throw error;
  }
}
