import { formatProgressPercent } from "@/lib/goals/progress";
import { cn } from "@/lib/utils";

export function GoalProgressBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {label ?? "Progreso operacional"}
        </span>
        <span className="font-medium tabular-nums">
          {formatProgressPercent(clamped)}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={label ?? "Progreso operacional"}
      >
        <div
          className="h-full bg-foreground/80 transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
