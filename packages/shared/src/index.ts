export const APP_NAME = 'talento' as const;

export type HealthStatus = {
  status: 'ok';
};

export type ReadyStatus = {
  status: 'ready' | 'not_ready';
};

export function createHealthResponse(): HealthStatus {
  return { status: 'ok' };
}

export function createReadyResponse(ready: boolean): ReadyStatus {
  return { status: ready ? 'ready' : 'not_ready' };
}

/**
 * Canonical document types for Candidate writes.
 *
 * Candidate.documentType remains a free String? in Prisma so historical
 * values (free text) are not migrated or rejected on read. New CREATE/UPDATE
 * payloads may only set a catalog code (or omit/clear the field).
 */
export const CANDIDATE_DOCUMENT_TYPES = [
  { code: 'TI', label: 'Tarjeta de Identidad' },
  { code: 'CC', label: 'Cédula de Ciudadanía' },
  { code: 'CE', label: 'Cédula de Extranjería' },
  { code: 'PASSPORT', label: 'Pasaporte' },
] as const;

export type CandidateDocumentType =
  (typeof CANDIDATE_DOCUMENT_TYPES)[number]['code'];

export const CANDIDATE_DOCUMENT_TYPE_CODES: CandidateDocumentType[] =
  CANDIDATE_DOCUMENT_TYPES.map((item) => item.code);

export function isCandidateDocumentType(
  value: string,
): value is CandidateDocumentType {
  return (CANDIDATE_DOCUMENT_TYPE_CODES as readonly string[]).includes(value);
}

/** Friendly label for a catalog code; unknown historical values are returned as-is. */
export function candidateDocumentTypeLabel(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const match = CANDIDATE_DOCUMENT_TYPES.find((item) => item.code === code);
  return match?.label ?? code;
}
