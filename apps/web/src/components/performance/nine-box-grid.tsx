"use client";

import { cn } from "@/lib/utils";
import {
  cellAt,
  type NineBoxCellConfig,
} from "@/lib/performance/nine-box";

type Person = {
  id: string;
  label: string;
};

type NineBoxGridProps = {
  cells: NineBoxCellConfig[];
  highlight?: { row: number; col: number } | null;
  peopleByCell?: Map<string, Person[]>;
  highlightLabel?: string;
  onDropPerson?: (personId: string, row: number, col: number) => void;
};

function keyOf(row: number, col: number) {
  return `${row}:${col}`;
}

export function NineBoxGrid({
  cells,
  highlight,
  peopleByCell,
  highlightLabel,
  onDropPerson,
}: NineBoxGridProps) {
  const displayRows = [2, 1, 0];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2">
        <div />
        <p className="text-center text-xs text-muted-foreground">
          Desempeño bajo
        </p>
        <p className="text-center text-xs text-muted-foreground">Medio</p>
        <p className="text-center text-xs text-muted-foreground">Alto</p>
        {displayRows.map((row) => (
          <Row
            key={row}
            row={row}
            cells={cells}
            highlight={highlight}
            peopleByCell={peopleByCell}
            highlightLabel={highlightLabel}
            onDropPerson={onDropPerson}
            axisLabel={
              row === 2 ? "Alto potencial" : row === 1 ? "Medio" : "Bajo potencial"
            }
          />
        ))}
      </div>
      {highlight ? (
        <p className="text-sm text-muted-foreground">
          {highlightLabel ?? "Posición"}:{" "}
          {cellAt(cells, highlight.row, highlight.col)?.label ?? "—"}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  row,
  cells,
  highlight,
  peopleByCell,
  highlightLabel,
  axisLabel,
  onDropPerson,
}: {
  row: number;
  cells: NineBoxCellConfig[];
  highlight?: { row: number; col: number } | null;
  peopleByCell?: Map<string, Person[]>;
  highlightLabel?: string;
  axisLabel: string;
  onDropPerson?: (personId: string, row: number, col: number) => void;
}) {
  return (
    <>
      <p className="self-center text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0">
        {axisLabel}
      </p>
      {[0, 1, 2].map((col) => {
        const cell = cellAt(cells, row, col);
        const active = highlight?.row === row && highlight?.col === col;
        const people = peopleByCell?.get(keyOf(row, col)) ?? [];
        return (
          <div
            key={col}
            className={cn(
              "min-h-[5.5rem] rounded-lg border p-2 text-sm",
              active && "ring-2 ring-primary ring-offset-2",
            )}
            style={{
              backgroundColor: cell ? `${cell.color}22` : undefined,
              borderColor: cell?.color,
            }}
            onDragOver={(event) => {
              if (!onDropPerson) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!onDropPerson) return;
              event.preventDefault();
              const personId = event.dataTransfer.getData("text/plain");
              if (personId) onDropPerson(personId, row, col);
            }}
          >
            <p className="font-medium" style={{ color: cell?.color }}>
              {cell?.label ?? "—"}
            </p>
            {active && highlightLabel ? (
              <p className="mt-1 text-xs">{highlightLabel}</p>
            ) : null}
            {people.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {people.slice(0, 6).map((person) => (
                  <li
                    key={person.id}
                    draggable={Boolean(onDropPerson)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", person.id);
                    }}
                    className={onDropPerson ? "cursor-grab" : undefined}
                  >
                    {person.label}
                  </li>
                ))}
                {people.length > 6 ? (
                  <li>+{people.length - 6} más</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function nineBoxPeopleKey(row: number, col: number) {
  return keyOf(row, col);
}
