"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import {
  occupantLabel,
  occupantNeedsSelection,
  type CargoOccupantRow,
} from "@/lib/ats/position-occupant";

type PositionOption = { value: string; label: string };

type PositionOccupantFieldsProps = {
  idPrefix: string;
  row: CargoOccupantRow;
  positions: PositionOption[];
  onChange: (patch: Partial<CargoOccupantRow>) => void;
};

function PositionOccupantFields({
  idPrefix,
  row,
  positions,
  onChange,
}: PositionOccupantFieldsProps) {
  const companyId = useCompanyId();
  const occupantsQuery = useQuery({
    queryKey: atsKeys.positionOccupants(companyId, row.positionId),
    queryFn: () => atsApi.listPositionOccupants(row.positionId),
    enabled: Boolean(row.positionId) && !row.locked,
  });
  const occupants = occupantsQuery.data ?? [];
  const showOccupant = occupantNeedsSelection(occupants);

  if (row.locked) {
    if (row.legacySummary) {
      return <p className="text-sm">{row.legacySummary}</p>;
    }
    const positionName =
      row.positionName ??
      positions.find((item) => item.value === row.positionId)?.label ??
      "Cargo";
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Cargo: </span>
          {positionName}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">Ocupante: </span>
          {row.occupantName ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormSelect
        id={`${idPrefix}-position`}
        label="Seleccionar cargo"
        required
        value={row.positionId}
        onChange={(positionId) => onChange({ positionId, occupantId: "" })}
        options={positions}
        placeholder="Seleccionar cargo"
      />
      {showOccupant ? (
        <FormSelect
          id={`${idPrefix}-occupant`}
          label="Nombre del ocupante"
          required
          value={row.occupantId}
          onChange={(occupantId) => onChange({ occupantId })}
          options={occupants.map((item) => ({
            value: item.id,
            label: occupantLabel(item),
          }))}
          placeholder="Nombre del ocupante"
        />
      ) : null}
      {row.positionId && occupantsQuery.isSuccess && occupants.length === 0 ? (
        <p className="text-sm text-destructive sm:col-span-2">
          Este cargo no tiene ocupantes activos con usuario.
        </p>
      ) : null}
    </div>
  );
}

type CargoOccupantListEditorProps = {
  rows: CargoOccupantRow[];
  onChange: (rows: CargoOccupantRow[]) => void;
  positions: PositionOption[];
  rowLabel: (index: number) => string;
  addLabel: string;
  emptyHint: string;
  readOnly?: boolean;
  lockedHint?: string;
};

export function CargoOccupantListEditor({
  rows,
  onChange,
  positions,
  rowLabel,
  addLabel,
  emptyHint,
  readOnly = false,
  lockedHint = "No se puede modificar: ya hay una decisión o evaluación.",
}: CargoOccupantListEditorProps) {
  function updateRow(index: number, patch: Partial<CargoOccupantRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : null}
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{rowLabel(index)}</p>
            {row.locked || readOnly ? (
              <p className="text-xs text-muted-foreground">{lockedHint}</p>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                onClick={() =>
                  onChange(rows.filter((_, i) => i !== index))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <PositionOccupantFields
            idPrefix={`${row.key}`}
            row={{ ...row, locked: row.locked || readOnly }}
            positions={positions}
            onChange={(patch) => updateRow(index, patch)}
          />
        </div>
      ))}
      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange([
              ...rows,
              {
                key: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                positionId: "",
                occupantId: "",
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
