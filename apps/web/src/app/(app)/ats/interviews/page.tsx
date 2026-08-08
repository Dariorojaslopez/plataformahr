import { Suspense } from "react";
import { InterviewsPageClient } from "@/components/ats/interviews-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <InterviewsPageClient />
    </Suspense>
  );
}
