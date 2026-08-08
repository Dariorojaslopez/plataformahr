import { Suspense } from "react";
import { EmployeesPageClient } from "@/components/organization/employees-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <EmployeesPageClient />
    </Suspense>
  );
}
