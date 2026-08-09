import { Suspense } from "react";
import { CyclesPageClient } from "@/components/performance/cycles-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function CyclesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <CyclesPageClient />
    </Suspense>
  );
}
