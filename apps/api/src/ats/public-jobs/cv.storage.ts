import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { resolveCompanyUploadsDir } from '../../core/companies/branding/branding.storage';
import {
  COMPANY_ID_PATTERN,
  CV_EXTENSION_BY_MIME,
  CV_FILE_NAME_PATTERN,
  type AllowedCvMime,
} from './cv.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for cv storage');
  }
}

export function assertSafeCvFileName(fileName: string): void {
  if (!CV_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid cv file name');
  }
}

export function buildCvFileName(
  mime: AllowedCvMime,
  id: string = crypto.randomUUID(),
): string {
  return `cv-${id}.${CV_EXTENSION_BY_MIME[mime]}`;
}

export function resolveCvAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeCvFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected cv path');
  }
  return absolute;
}

export async function writeCvFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveCvAbsolutePath(
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

export async function readCvFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveCvAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteCvFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveCvAbsolutePath(
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
