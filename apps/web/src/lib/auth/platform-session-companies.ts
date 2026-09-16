import type { PublicCompany, PublicUser } from "@/types/auth";

/**
 * Platform owners can enter any ACTIVE tenant. Memberships alone are not
 * the catalog — that would hide companies they created but never joined.
 */
export async function resolveSelectableCompanies(input: {
  user: Pick<PublicUser, "isPlatformOwner">;
  membershipCompanies: PublicCompany[];
  loadPlatformCompanies: () => Promise<PublicCompany[]>;
}): Promise<PublicCompany[]> {
  if (!input.user.isPlatformOwner) {
    return input.membershipCompanies;
  }
  try {
    const platformCompanies = await input.loadPlatformCompanies();
    return platformCompanies.length > 0
      ? platformCompanies
      : input.membershipCompanies;
  } catch {
    return input.membershipCompanies;
  }
}
