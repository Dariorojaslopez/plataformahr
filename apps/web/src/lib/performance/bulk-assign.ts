import type { BulkAssignParticipantsInput } from "@/types/performance";

/** Builds the bulk assign body; dedupes while preserving first-seen order. */
export function buildBulkAssignPayload(
  employeeIds: string[],
): BulkAssignParticipantsInput {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of employeeIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return { employeeIds: unique };
}

export const BULK_ASSIGN_MAX = 100;

export function chunkEmployeeIds(
  employeeIds: string[],
  size = BULK_ASSIGN_MAX,
): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < employeeIds.length; i += size) {
    chunks.push(employeeIds.slice(i, i + size));
  }
  return chunks;
}
