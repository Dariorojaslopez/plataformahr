export function recruiterSeesAssignedOnly(roleCodes: string[]): boolean {
  return roleCodes.includes("RECRUITER") && !roleCodes.includes("CLIENT_ADMIN");
}
