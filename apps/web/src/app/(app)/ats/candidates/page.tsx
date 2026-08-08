import { Suspense } from "react";
import { CandidatesPageClient } from "@/components/ats/candidates-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <CandidatesPageClient />
    </Suspense>
  );
}
