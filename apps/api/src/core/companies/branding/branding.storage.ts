import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import {
  COMPANY_ID_PATTERN,
  DEFAULT_COMPANY_UPLOADS_DIR,
  LOGO_EXTENSION_BY_MIME,
  LOGO_FILE_NAME_PATTERN,
  type AllowedLogoMime,
} from './branding.constants';

export function resolveCompanyUploadsDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env.COMPANY_UPLOADS_DIR?.trim();
  if (fromEnv) return resolve(fromEnv);
  if (env.NODE_ENV === 'production') {
    throw new Error('COMPANY_UPLOADS_DIR is required in production');
  }
  return resolve(process.cwd(), DEFAULT_COMPANY_UPLOADS_DIR);
}

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for logo storage');
  }
}

export function assertSafeLogoFileName(fileName: string): void {
  if (!LOGO_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid logo file name');
  }
}

export function buildLogoFileName(
  mime: AllowedLogoMime,
  id: string = crypto.randomUUID(),
): string {
  return `${id}.${LOGO_EXTENSION_BY_MIME[mime]}`;
}

/**
 * Resolve a logo path under the uploads root. Rejects traversal and user paths.
 */
export function resolveLogoAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeLogoFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected logo path');
  }
  return absolute;
}

export async function writeCompanyLogoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveLogoAbsolutePath(
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

export async function readCompanyLogoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveLogoAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteCompanyLogoFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveLogoAbsolutePath(
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
