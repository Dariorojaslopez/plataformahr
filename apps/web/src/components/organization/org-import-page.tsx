"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { downloadBlob } from "@/components/organization/org-chart-export";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage, ApiError } from "@/lib/api/errors";
import { organizationApi } from "@/lib/api/organization";
import type {
  OrgImportApplyResult,
  OrgImportPreview,
  OrgImportSummary,
} from "@/types/organization";

const MAX_BYTES = 6 * 1024 * 1024;

const ENTITY_LABELS: Array<{ key: keyof OrgImportSummary; label: string }> = [
  { key: "businessUnits", label: "Unidades" },
  { key: "areas", label: "Áreas" },
  { key: "jobLevels", label: "Niveles" },
  { key: "positions", label: "Cargos" },
  { key: "employees", label: "Colaboradores" },
  { key: "reportingLines", label: "Relaciones de reporte" },
];

function previewFromError(error: unknown): OrgImportPreview | null {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") {
    return null;
  }
  const details = error.details as Partial<OrgImportPreview>;
  if (!Array.isArray(details.issues) || !details.summary) return null;
  return details as OrgImportPreview;
}

export function formatEntityCounts(
  label: string,
  counts: OrgImportSummary[keyof OrgImportSummary],
): string {
  const parts: string[] = [];
  if (counts.create) parts.push(`${counts.create} creadas`);
  if (counts.update) parts.push(`${counts.update} actualizadas`);
  if (counts.omit) parts.push(`${counts.omit} sin cambios`);
  return parts.length ? `${label}: ${parts.join(" / ")}` : `${label}: sin cambios`;
}

export function OrgImportPageClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrgImportPreview | null>(null);
  const [result, setResult] = useState<OrgImportApplyResult | null>(null);

  const templateMutation = useMutation({
    mutationFn: () => organizationApi.downloadImportTemplate(),
    onSuccess: ({ blob, filename }) => {
      downloadBlob(filename ?? "plantilla-organizacion.csv", blob);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (content: string) => organizationApi.previewImport(content),
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
    },
  });

  const applyMutation = useMutation({
    mutationFn: (content: string) => organizationApi.applyImport(content),
    onSuccess: (data) => {
      setResult(data);
      setPreview(data);
    },
    onError: (error) => {
      const fromError = previewFromError(error);
      if (fromError) setPreview(fromError);
    },
  });

  function onFile(file: File | undefined) {
    setLocalError(null);
    setPreview(null);
    setResult(null);
    setCsv(null);
    setFileName(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setLocalError("Solo se admite un archivo CSV UTF-8.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("El archivo supera el máximo de 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsv(text);
      setFileName(file.name);
    };
    reader.readAsText(file, "UTF-8");
  }

  const blockingErrors = preview?.issues.filter((item) => item.level === "error") ?? [];
  const warnings = preview?.issues.filter((item) => item.level === "warning") ?? [];
  const canApply = Boolean(csv && preview?.canApply && blockingErrors.length === 0);

  return (
    <div>
      <PageHeader
        title="Importación masiva"
        description="Carga la estructura y los colaboradores con un CSV. Primero se valida; nada se escribe hasta que confirmes."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => templateMutation.mutate()}
            disabled={templateMutation.isPending}
          >
            <Download className="h-4 w-4" />
            Descargar plantilla
          </Button>
        }
      />

      <div className="space-y-6">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Seleccionar archivo CSV</span>
          <span className="mt-1 text-xs text-muted-foreground">
            UTF-8, máximo 6 MB y 4.000 filas. {fileName ?? "Ningún archivo"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Archivo CSV"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>

        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!csv || previewMutation.isPending}
            onClick={() => csv && previewMutation.mutate(csv)}
          >
            Validar
          </Button>
          <Button
            type="button"
            disabled={!canApply || applyMutation.isPending}
            onClick={() => csv && applyMutation.mutate(csv)}
          >
            Aplicar importación
          </Button>
        </div>

        {previewMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(previewMutation.error, "No se pudo validar el archivo.")}
          </p>
        ) : null}
        {applyMutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(applyMutation.error, "No se pudo aplicar la importación.")}
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {preview.rowsTotal} filas · {preview.rowsValid} válidas ·{" "}
              {preview.rowsInvalid} inválidas
              {preview.rowsEmpty ? ` · ${preview.rowsEmpty} vacías` : ""}
            </p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {ENTITY_LABELS.map(({ key, label }) => (
                <li key={key}>{formatEntityCounts(label, preview.summary[key])}</li>
              ))}
            </ul>

            {blockingErrors.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-medium">Errores por fila</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockingErrors.slice(0, 100).map((item, index) => (
                      <TableRow key={`${item.row}-${item.field}-${index}`}>
                        <TableCell>{item.row}</TableCell>
                        <TableCell>{item.field}</TableCell>
                        <TableCell>{item.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title="Sin errores bloqueantes"
                description="Puedes aplicar la importación. Los registros se crean o actualizan por código (email en colaboradores)."
              />
            )}

            {warnings.length > 0 ? (
              <ul className="text-sm text-muted-foreground">
                {warnings.slice(0, 20).map((item, index) => (
                  <li key={`${item.row}-w-${index}`}>{item.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {result?.applied ? (
          <div className="rounded-lg border border-border p-4" data-testid="import-result">
            <h2 className="mb-2 font-medium">Importación aplicada</h2>
            <ul className="space-y-1 text-sm">
              {ENTITY_LABELS.map(({ key, label }) => (
                <li key={key}>{formatEntityCounts(label, result.summary[key])}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
