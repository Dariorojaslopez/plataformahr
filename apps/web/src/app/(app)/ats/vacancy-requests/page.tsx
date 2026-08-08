import { Suspense } from "react";
import { VacancyRequestsPageClient } from "@/components/ats/vacancy-requests-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <VacancyRequestsPageClient />
    </Suspense>
  );
}
