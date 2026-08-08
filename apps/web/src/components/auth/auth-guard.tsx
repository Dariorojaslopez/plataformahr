"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/components/auth/session-provider";
import { Skeleton } from "@/components/ui/skeleton";

type AuthGuardProps = {
  children: ReactNode;
  requireCompany?: boolean;
  requirePlatformOwner?: boolean;
};

export function AuthGuard({
  children,
  requireCompany = true,
  requirePlatformOwner = false,
}: AuthGuardProps) {
  const router = useRouter();
  const { status, user, activeCompanyId, companies } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "anonymous" || !user) {
      router.replace("/login");
      return;
    }

    if (requirePlatformOwner && !user.isPlatformOwner) {
      router.replace("/dashboard");
      return;
    }

    if (requireCompany) {
      if (companies.length === 0 || !activeCompanyId) {
        router.replace("/select-company");
      }
    }
  }, [
    status,
    user,
    activeCompanyId,
    companies.length,
    requireCompany,
    requirePlatformOwner,
    router,
  ]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (requirePlatformOwner && !user.isPlatformOwner) return null;

  if (requireCompany && (!activeCompanyId || companies.length === 0)) {
    return null;
  }

  return <>{children}</>;
}
