import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { resolveCompanyUploadsDir } from '../../core/companies/branding/branding.storage';
import {
  COMPANY_ID_PATTERN,
  PREHIRE_EXTENSION_BY_MIME,
  PREHIRE_FILE_NAME_PATTERN,
  type AllowedPreHireMime,
} from './prehire.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for prehire storage');
  }
}

export function assertSafePreHireFileName(fileName: string): void {
  if (!PREHIRE_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid prehire file name');
  }
}

export function buildPreHireFileName(
  kind: 'SECURITY_STUDY' | 'MEDICAL_EXAM',
  mime: AllowedPreHireMime,
  id: string = crypto.randomUUID(),
): string {
  const kindSlug =
    kind === 'SECURITY_STUDY' ? 'security_study' : 'medical_exam';
  return `prehire-${kindSlug}-${id}.${PREHIRE_EXTENSION_BY_MIME[mime]}`;
}

export function resolvePreHireAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafePreHireFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected prehire path');
  }
  return absolute;
}

export async function writePreHireFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolvePreHireAbsolutePath(
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

export async function readPreHireFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolvePreHireAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deletePreHireFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolvePreHireAbsolutePath(
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
