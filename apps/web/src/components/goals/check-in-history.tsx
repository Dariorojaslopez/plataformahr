"use client";

import { safeHttpUrl } from "@/lib/ui/safe-url";
import type { GoalCheckIn } from "@/types/goals";

export function CheckInHistoryList({ items }: { items: GoalCheckIn[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay avances registrados.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const safeUrl = item.evidenceReference
          ? safeHttpUrl(item.evidenceReference)
          : null;
        const author =
          item.createdByEmployee
            ? `${item.createdByEmployee.firstName} ${item.createdByEmployee.lastName}`
            : item.createdBy
              ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
              : "Usuario";
        const valueLabel =
          item.booleanValue != null
            ? item.booleanValue
              ? "Completado: Sí"
              : "Completado: No"
            : (item.numericValue ?? "—");

        return (
          <li
            key={item.id}
            className="border-l-2 border-border pl-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium tabular-nums">#{item.sequence}</span>
              <time className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("es")}
              </time>
            </div>
            <p>
              <span className="text-muted-foreground">Valor: </span>
              {valueLabel}
            </p>
            <p className="text-muted-foreground">Autor: {author}</p>
            {item.comment ? <p>{item.comment}</p> : null}
            {item.evidenceReference ? (
              <p>
                Evidencia:{" "}
                {safeUrl ? (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Abrir referencia
                  </a>
                ) : (
                  <span>{item.evidenceReference}</span>
                )}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
