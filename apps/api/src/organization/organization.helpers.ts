import { BadRequestException } from '@nestjs/common';

/**
 * Walk ancestor chain looking for a cycle when assigning parentId to nodeId.
 * parentsById maps childId -> parentId | null.
 */
export function wouldCreateParentCycle(
  nodeId: string,
  parentId: string,
  parentsById: Map<string, string | null>,
): boolean {
  if (nodeId === parentId) {
    return true;
  }

  let current: string | null | undefined = parentId;
  const visited = new Set<string>();

  while (current) {
    if (current === nodeId) {
      return true;
    }
    if (visited.has(current)) {
      return true;
    }
    visited.add(current);
    current = parentsById.get(current) ?? null;
  }

  return false;
}

/**
 * Detect whether linking employee -> manager would create a reporting cycle.
 * Edges are directed from employee to manager (reports-to).
 */
export function wouldCreateReportingCycle(
  employeeId: string,
  managerId: string,
  reportsToByEmployee: Map<string, string[]>,
): boolean {
  if (employeeId === managerId) {
    return true;
  }

  const stack = [managerId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current === employeeId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const managers = reportsToByEmployee.get(current) ?? [];
    for (const next of managers) {
      stack.push(next);
    }
  }

  return false;
}

export function assertNoCycle(condition: boolean, message: string): void {
  if (condition) {
    throw new BadRequestException(message);
  }
}

export function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
