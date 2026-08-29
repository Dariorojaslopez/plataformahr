import { Suspense } from "react";
import { ScalesPageClient } from "@/components/performance/scales-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationScalesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ScalesPageClient />
    </Suspense>
  );
}
