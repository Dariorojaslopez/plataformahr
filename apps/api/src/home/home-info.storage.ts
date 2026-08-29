import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { COMPANY_ID_PATTERN } from '../core/companies/branding/branding.constants';
import { resolveCompanyUploadsDir } from '../core/companies/branding/branding.storage';
import {
  HOME_INFO_EXTENSION_BY_MIME,
  HOME_INFO_FILE_NAME_PATTERN,
  type AllowedHomeInfoMime,
} from './home-info.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for home info storage');
  }
}

export function assertSafeHomeInfoFileName(fileName: string): void {
  if (!HOME_INFO_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid home info file name');
  }
}

export function buildHomeInfoFileName(
  mime: AllowedHomeInfoMime,
  id: string = crypto.randomUUID(),
): string {
  return `info-${id}.${HOME_INFO_EXTENSION_BY_MIME[mime]}`;
}

/**
 * Resolve a HOME info media path. Rejects traversal and user paths.
 */
export function resolveHomeInfoAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeHomeInfoFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected home info path');
  }
  return absolute;
}

export async function writeHomeInfoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveHomeInfoAbsolutePath(
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

export async function readHomeInfoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveHomeInfoAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteHomeInfoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveHomeInfoAbsolutePath(
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
