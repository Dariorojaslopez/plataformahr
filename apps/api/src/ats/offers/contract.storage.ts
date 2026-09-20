import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { COMPANY_ID_PATTERN } from '../../core/companies/branding/branding.constants';
import { resolveCompanyUploadsDir } from '../../core/companies/branding/branding.storage';
import {
  CONTRACT_EXTENSION_BY_MIME,
  CONTRACT_SIGNED_FILE_NAME_PATTERN,
  CONTRACT_SIGN_IMAGE_EXTENSION_BY_MIME,
  type AllowedContractMime,
  type AllowedContractSignImageMime,
} from './contract.constants';

export { resolveCompanyUploadsDir };

export function assertSafeCompanyId(companyId: string): void {
  if (!COMPANY_ID_PATTERN.test(companyId)) {
    throw new Error('Invalid company id for contract storage');
  }
}

export function assertSafeContractSignedFileName(fileName: string): void {
  if (!CONTRACT_SIGNED_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid signed contract file name');
  }
}

export function buildContractSignedFileName(
  mime: AllowedContractMime,
  id: string = crypto.randomUUID(),
): string {
  return `contract-signed-${id}.${CONTRACT_EXTENSION_BY_MIME[mime]}`;
}

export function buildContractSignImageFileName(
  mime: AllowedContractSignImageMime,
  id: string = crypto.randomUUID(),
): string {
  return `contract-signimg-${id}.${CONTRACT_SIGN_IMAGE_EXTENSION_BY_MIME[mime]}`;
}

export function buildContractCandidateSignedFileName(
  mime: AllowedContractMime,
  id: string = crypto.randomUUID(),
): string {
  return `contract-candsigned-${id}.${CONTRACT_EXTENSION_BY_MIME[mime]}`;
}

export function resolveContractSignedAbsolutePath(
  uploadsDir: string,
  companyId: string,
  fileName: string,
): string {
  assertSafeCompanyId(companyId);
  assertSafeContractSignedFileName(fileName);
  const root = resolve(uploadsDir);
  const absolute = resolve(root, companyId, fileName);
  const rel = relative(root, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(`..${sep}`) ||
    rel.split(sep).length !== 2
  ) {
    throw new Error('Rejected contract path');
  }
  return absolute;
}

export async function writeContractSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<string> {
  const absolute = resolveContractSignedAbsolutePath(
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

export async function readContractSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<Buffer> {
  const absolute = resolveContractSignedAbsolutePath(
    options.uploadsDir,
    options.companyId,
    options.fileName,
  );
  return readFile(absolute);
}

export async function deleteContractSignedFile(options: {
  uploadsDir: string;
  companyId: string;
  fileName: string;
}): Promise<void> {
  const absolute = resolveContractSignedAbsolutePath(
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
