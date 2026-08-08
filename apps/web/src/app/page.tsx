"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/auth/session-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const router = useRouter();
  const { status, user, companies, activeCompanyId } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.isPlatformOwner) {
      router.replace("/platform");
      return;
    }
    if (!activeCompanyId) {
      router.replace(companies.length > 0 ? "/select-company" : "/select-company");
      return;
    }
    router.replace("/dashboard");
  }, [status, user, companies.length, activeCompanyId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
