"use client";

import { useSession } from "@/components/auth/session-provider";
import { CompanyHome } from "@/components/dashboard/company-home";
import {
  homeShortcutsFor,
  resolveHomeRoleFromAccess,
} from "@/lib/home/home-view";

export default function DashboardPage() {
  const { user, activeCompany, companyAccess } = useSession();

  if (!companyAccess) return null;

  const homeRole = resolveHomeRoleFromAccess(companyAccess);

  return (
    <CompanyHome
      firstName={user?.firstName ?? ""}
      companyName={activeCompany?.name ?? ""}
      companySlug={activeCompany?.slug ?? ""}
      homeRole={homeRole}
      hasDirectReports={companyAccess.hasDirectReports ?? false}
      shortcuts={homeShortcutsFor(homeRole, companyAccess)}
    />
  );
}
