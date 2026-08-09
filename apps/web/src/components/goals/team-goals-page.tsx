"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { GoalProgressBar } from "@/components/goals/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import { formatAchievementPercent } from "@/lib/goals/completion";
import { GOAL_TYPE_LABELS } from "@/lib/goals/labels";

export function TeamGoalsPageClient() {
  const companyId = useCompanyId();
  const teamQuery = useQuery({
    queryKey: goalKeys.team(companyId),
    queryFn: () => goalsApi.listTeam(),
  });

  const employees = teamQuery.data?.employees ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi equipo"
        description="Seguimiento operacional (ACTIVE) y cumplimiento final (COMPLETED) de reportes DIRECTOS. Sin ranking ni score de desempeño."
      />

      {teamQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {teamQuery.isError ? (
        <ErrorState
          title="No se pudo cargar el equipo"
          description={getErrorMessage(teamQuery.error, "Error")}
          onRetry={() => void teamQuery.refetch()}
        />
      ) : null}
      {teamQuery.isSuccess && employees.length === 0 ? (
        <EmptyState
          title="Sin reportes directos"
          description="Cuando tengas líneas de reporte DIRECT activas, verás aquí sus objetivos aplicables."
        />
      ) : null}

      <div className="space-y-6">
        {employees.map(({ employee, goals }) => (
          <section
            key={employee.id}
            className="space-y-3 rounded-lg border border-border p-4"
            aria-label={`${employee.firstName} ${employee.lastName}`}
          >
            <header>
              <h2 className="text-base font-semibold">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[employee.position?.name, employee.area?.name]
                  .filter(Boolean)
                  .join(" · ") || employee.email}
              </p>
            </header>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin objetivos ACTIVE aplicables.
              </p>
            ) : (
              <ul className="space-y-3">
                {goals.map((goal) => (
                  <li key={goal.id} className="space-y-2 border-t pt-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/goals/${goal.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {goal.title}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {GOAL_TYPE_LABELS[goal.type]} · {goal.cycle.name}
                      </span>
                    </div>
                    {goal.status === "COMPLETED" ? (
                      <p className="text-sm font-medium tabular-nums">
                        Cumplimiento final:{" "}
                        {formatAchievementPercent(goal.achievementPercentage)}
                      </p>
                    ) : (
                      <GoalProgressBar value={goal.progressPercentage ?? 0} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
