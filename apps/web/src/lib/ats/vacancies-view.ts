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

type AssignableRecruiterProcess = {
  status: string;
  title: string;
  vacancyId: string | null;
  vacancyStatus: string | null;
};

export function approvedActiveProcessesForRecruiterAssignment<
  T extends AssignableRecruiterProcess,
>(items: T[]): Array<T & { vacancyId: string }> {
  return items.filter(
    (item): item is T & { vacancyId: string } =>
      item.status === "APPROVED" &&
      Boolean(item.vacancyId) &&
      (item.vacancyStatus === "OPEN" || item.vacancyStatus === "PAUSED"),
  );
}
