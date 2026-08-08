import { Suspense } from "react";
import { PipelinePageClient } from "@/components/ats/pipeline-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <PipelinePageClient />
    </Suspense>
  );
}
