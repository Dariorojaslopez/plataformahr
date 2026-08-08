import { Suspense } from "react";
import { VacanciesPageClient } from "@/components/ats/vacancies-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <VacanciesPageClient />
    </Suspense>
  );
}
