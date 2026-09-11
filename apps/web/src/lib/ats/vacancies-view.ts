export function recruiterSeesAssignedOnly(roleCodes: string[]): boolean {
  if (
    roleCodes.includes("CLIENT_ADMIN") ||
    roleCodes.includes("ADMINISTRATOR") ||
    roleCodes.includes("RECRUITMENT_LEADER")
  ) {
    return false;
  }
  return roleCodes.includes("RECRUITER");
}
