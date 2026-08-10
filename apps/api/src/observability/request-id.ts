import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Safe request IDs: printable ASCII, no whitespace, length 8–128. */
const REQUEST_ID_PATTERN = /^[\x21-\x7E]{8,128}$/;

export function isValidRequestId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  if (!REQUEST_ID_PATTERN.test(trimmed)) return false;
  // Reject header injection / control-like sequences already covered by pattern.
  return true;
}

export function resolveRequestId(incoming: unknown): string {
  if (Array.isArray(incoming)) {
    return resolveRequestId(incoming[0]);
  }
  if (isValidRequestId(incoming)) {
    return incoming.trim();
  }
  return randomUUID();
}
