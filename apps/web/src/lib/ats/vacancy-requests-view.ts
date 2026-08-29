import type { CompanyHomeRole } from "@talento/shared";

export function isLeaderSelectionProcessView(
  homeRole: CompanyHomeRole | string | undefined,
): boolean {
  return homeRole === "LEADER";
}

export function selectionProcessPageTitle(
  homeRole: CompanyHomeRole | string | undefined,
): string {
  return isLeaderSelectionProcessView(homeRole)
    ? "Mis procesos de selección"
    : "Crear proceso de selección";
}

export function selectionProcessNavLabel(
  homeRole: CompanyHomeRole | string | undefined,
): string {
  return isLeaderSelectionProcessView(homeRole)
    ? "Mis procesos de selección"
    : "Crear proceso de selección";
}

export function canProxyVacancyRequester(roleCodes: readonly string[]): boolean {
  return roleCodes.includes("CLIENT_ADMIN") || roleCodes.includes("RECRUITER");
}
