import { Suspense } from "react";
import { CompetenciesPageClient } from "@/components/performance/competencies-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompetenciesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <CompetenciesPageClient />
    </Suspense>
  );
}
