import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { COMPANY_ID_PATTERN } from '../branding/branding.constants';
import { resolveCompanyUploadsDir } from '../branding/branding.storage';
import {
  ATS_TEMPLATE_EXTENSION_BY_MIME,
  ATS_TEMPLATE_FILE_NAME_PATTERN,
  ATS_TEMPLATE_KIND_SLUG,
  type AllowedAtsTemplateMime,
  type AtsTemplateKind,
} from './ats-templates.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for ats template storage');
  }
}

export function assertSafeAtsTemplateFileName(fileName: string): void {
  if (!ATS_TEMPLATE_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid ats template file name');
  }
}

export function buildAtsTemplateFileName(
  kind: AtsTemplateKind,
  mime: AllowedAtsTemplateMime,
  id: string = crypto.randomUUID(),
): string {
  return `ats-tmpl-${ATS_TEMPLATE_KIND_SLUG[kind]}-${id}.${ATS_TEMPLATE_EXTENSION_BY_MIME[mime]}`;
}

export function resolveAtsTemplateAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeAtsTemplateFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected ats template path');
  }
  return absolute;
}

export async function writeAtsTemplateFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveAtsTemplateAbsolutePath(
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

export async function readAtsTemplateFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveAtsTemplateAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteAtsTemplateFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveAtsTemplateAbsolutePath(
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
