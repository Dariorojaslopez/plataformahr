import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GOAL_TYPE_LABELS } from "@/lib/goals/labels";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import type {
  PerformanceResultEmployeeGoalSnapshot,
  PerformanceResultGoalSnapshot,
} from "@/types/performance";
import type { GoalType } from "@/types/goals";

type GoalRow =
  | PerformanceResultGoalSnapshot
  | PerformanceResultEmployeeGoalSnapshot;

function goalTypeLabel(goalType: string): string {
  if (goalType in GOAL_TYPE_LABELS) {
    return GOAL_TYPE_LABELS[goalType as GoalType];
  }
  return goalType;
}

export function ResultGoalsBreakdown({
  goals,
  showConfiguredWeight = false,
}: {
  goals: GoalRow[];
  showConfiguredWeight?: boolean;
}) {
  if (goals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay objetivos aplicables en el consolidado.
      </p>
    );
  }

  const sorted = [...goals].sort((a, b) => a.order - b.order);

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objetivo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cumplimiento</TableHead>
              {showConfiguredWeight ? <TableHead>Peso config.</TableHead> : null}
              <TableHead>Peso efectivo</TableHead>
              <TableHead>Contribución</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((goal, index) => (
              <TableRow key={`${goal.goalTitle}-${goal.order}-${index}`}>
                <TableCell className="font-medium">{goal.goalTitle}</TableCell>
                <TableCell>{goalTypeLabel(goal.goalType)}</TableCell>
                <TableCell>
                  {formatScorePercentage(goal.achievementPercentage)}
                </TableCell>
                {showConfiguredWeight ? (
                  <TableCell>
                    {"configuredWeight" in goal &&
                    goal.configuredWeight != null
                      ? formatScorePercentage(goal.configuredWeight)
                      : "—"}
                  </TableCell>
                ) : null}
                <TableCell>
                  {formatScorePercentage(goal.effectiveWeight)}
                </TableCell>
                <TableCell>
                  {formatScorePercentage(goal.contribution)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {sorted.map((goal, index) => (
          <div
            key={`${goal.goalTitle}-${goal.order}-${index}`}
            className="space-y-1 rounded-lg border border-border p-3 text-sm"
          >
            <p className="font-medium">{goal.goalTitle}</p>
            <p className="text-muted-foreground">
              {goalTypeLabel(goal.goalType)} · Cumplimiento{" "}
              {formatScorePercentage(goal.achievementPercentage)}
            </p>
            <p className="text-muted-foreground">
              Peso efectivo {formatScorePercentage(goal.effectiveWeight)} ·
              Contribución {formatScorePercentage(goal.contribution)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
