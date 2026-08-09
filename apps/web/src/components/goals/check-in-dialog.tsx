"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCheckInPayload,
  formatCurrentValue,
} from "@/lib/goals/progress";
import type { GoalKeyResultProgress, GoalMetricType } from "@/types/goals";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: GoalKeyResultProgress;
  pending: boolean;
  onSubmit: (body: {
    numericValue?: number;
    booleanValue?: boolean;
    comment?: string | null;
    evidenceReference?: string | null;
  }) => void;
};

export function CheckInDialog({
  open,
  onOpenChange,
  keyResult,
  pending,
  onSubmit,
}: Props) {
  const [numericText, setNumericText] = useState("");
  const [booleanValue, setBooleanValue] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  const metricType = keyResult.metricType as GoalMetricType;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = buildCheckInPayload({
        metricType,
        numericText,
        booleanValue,
        comment,
        evidenceReference: evidence,
      });
      setError(null);
      onSubmit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datos inválidos");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar avance</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            {keyResult.title}
            {" · Actual: "}
            {formatCurrentValue({
              metricType,
              currentNumericValue: keyResult.currentNumericValue,
              currentBooleanValue: keyResult.currentBooleanValue,
              currencyCode: keyResult.currencyCode,
              unit: keyResult.unit,
            })}
            {keyResult.targetValue != null
              ? ` · Meta: ${
                  keyResult.currencyCode
                    ? `${keyResult.currencyCode} `
                    : ""
                }${keyResult.targetValue}`
              : keyResult.metricType === "BOOLEAN"
                ? " · Meta: Completado"
                : ""}
          </p>

          {metricType === "BOOLEAN" ? (
            <div className="space-y-2">
              <Label>Completado</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={booleanValue === true ? "default" : "outline"}
                  onClick={() => setBooleanValue(true)}
                >
                  Sí
                </Button>
                <Button
                  type="button"
                  variant={booleanValue === false ? "default" : "outline"}
                  onClick={() => setBooleanValue(false)}
                >
                  No
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="checkin-value">
                Nuevo valor
                {metricType === "CURRENCY" && keyResult.currencyCode
                  ? ` (${keyResult.currencyCode})`
                  : ""}
              </Label>
              <Input
                id="checkin-value"
                inputMode="decimal"
                value={numericText}
                onChange={(e) => setNumericText(e.target.value)}
                placeholder="Ej. 8.5"
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="checkin-comment">Comentario (opcional)</Label>
            <Input
              id="checkin-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkin-evidence">
              Referencia / evidencia (opcional)
            </Label>
            <Input
              id="checkin-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={1000}
              placeholder="JIRA-123 o URL corporativa"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando…" : "Registrar avance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
