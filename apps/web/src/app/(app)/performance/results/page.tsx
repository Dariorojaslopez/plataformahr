import { Suspense } from "react";
import { ResultsPageClient } from "@/components/performance/results-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResultsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <ResultsPageClient />
    </Suspense>
  );
}
