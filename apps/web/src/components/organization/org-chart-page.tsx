"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { NO_BUSINESS_UNIT_LABEL } from "@/components/organization/area-form";
import { FormSelect } from "@/components/organization/form-select";
import {
  buildPdfFromJpeg,
  canvasJpegBytes,
  downloadBlob,
  svgToPngBlob,
} from "@/components/organization/org-chart-export";
import { layoutOrgChart, layoutToSvg } from "@/components/organization/org-chart-layout";
import { OrgChartTree } from "@/components/organization/org-chart-tree";
import {
  OrgChartViewport,
  clampScale,
} from "@/components/organization/org-chart-viewport";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  ORG_CHART_UNASSIGNED,
  countOrgChartNodes,
  filterOrgChartForest,
} from "@/lib/organization/org-chart-filter";

export function OrgChartPageClient() {
  const companyId = useCompanyId();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [jobLevelId, setJobLevelId] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const query = useQuery({
    queryKey: orgKeys.orgChart(companyId, includeInactive),
    queryFn: () => organizationApi.getOrgChart(includeInactive),
  });
  const buQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });
  const levelsQuery = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
  });

  const hasBusinessUnits = (buQuery.data?.length ?? 0) > 0;
  const hasJobLevels = (levelsQuery.data?.length ?? 0) > 0;
  const filteredRoots = useMemo(
    () =>
      filterOrgChartForest(query.data?.roots ?? [], {
        businessUnitId: businessUnitId || undefined,
        jobLevelId: jobLevelId || undefined,
      }),
    [query.data?.roots, businessUnitId, jobLevelId],
  );
  const visibleCount = countOrgChartNodes(filteredRoots);
  const layout = useMemo(() => {
    if (!query.data) return null;
    return layoutOrgChart(query.data.company.name, filteredRoots);
  }, [query.data, filteredRoots]);

  const exportMutation = useMutation({
    mutationFn: async (format: "png" | "pdf") => {
      if (!query.data || !layout) {
        throw new Error("El organigrama aún no está listo.");
      }
      const generatedAt = new Date(query.data.generatedAt).toLocaleString("es");
      const svg = layoutToSvg(layout, { generatedAt });
      const stamp = new Date().toISOString().slice(0, 10);
      const base = `organigrama-${query.data.company.name}-${stamp}`.replaceAll(
        /\s+/g,
        "-",
      );
      if (format === "png") {
        const png = await svgToPngBlob(svg);
        downloadBlob(`${base}.png`, png);
        return;
      }
      const jpeg = await canvasJpegBytes(svg);
      const pdf = buildPdfFromJpeg(jpeg.jpeg, jpeg.width, jpeg.height);
      const pdfCopy = new Uint8Array(pdf.byteLength);
      pdfCopy.set(pdf);
      downloadBlob(
        `${base}.pdf`,
        new Blob([pdfCopy], { type: "application/pdf" }),
      );
    },
  });

  const chart = query.data;

  function toggle(id: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function zoomBy(delta: number) {
    setScale((current) => clampScale(current + delta));
  }

  return (
    <div>
      <PageHeader
        title="Organigrama"
        description="Jerarquía real de reporte directo. No se infiere por área ni cargo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={includeInactive}
                onCheckedChange={(checked) =>
                  setIncludeInactive(checked === true)
                }
              />
              Incluir inactivos
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate("png")}
              disabled={
                !query.data || exportMutation.isPending || visibleCount === 0
              }
            >
              <Download className="h-4 w-4" />
              PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate("pdf")}
              disabled={
                !query.data || exportMutation.isPending || visibleCount === 0
              }
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-[480px] w-full" />
      ) : query.isError ? (
        <ErrorState
          description={getErrorMessage(
            query.error,
            "No se pudo cargar el organigrama.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : !chart || chart.employeeCount === 0 ? (
        <EmptyState
          title="Sin colaboradores"
          description="Cuando existan empleados, el organigrama se arma con las líneas de reporte directo."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {hasBusinessUnits ? (
              <FormSelect
                id="org-chart-bu"
                label="Unidad de negocio"
                className="w-[220px]"
                value={businessUnitId}
                onChange={setBusinessUnitId}
                allowEmpty
                emptyLabel="Todas"
                options={[
                  { value: ORG_CHART_UNASSIGNED, label: NO_BUSINESS_UNIT_LABEL },
                  ...(buQuery.data ?? []).map((unit) => ({
                    value: unit.id,
                    label: unit.name,
                  })),
                ]}
              />
            ) : null}
            {hasJobLevels ? (
              <FormSelect
                id="org-chart-level"
                label="Nivel"
                className="w-[220px]"
                value={jobLevelId}
                onChange={setJobLevelId}
                allowEmpty
                emptyLabel="Todos"
                options={[
                  { value: ORG_CHART_UNASSIGNED, label: "Sin nivel" },
                  ...[...(levelsQuery.data ?? [])]
                    .sort((a, b) => a.rank - b.rank)
                    .map((level) => ({
                      value: level.id,
                      label: level.name,
                    })),
                ]}
              />
            ) : null}
          </div>
          {visibleCount === 0 ? (
            <EmptyState
              title="Nadie coincide con los filtros"
              description="Cambia la unidad o el nivel para ver otra segmentación del organigrama."
            />
          ) : (
            <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Alejar"
              onClick={() => zoomBy(-0.1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Acercar"
              onClick={() => zoomBy(0.1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer
            </Button>
            <span className="text-xs text-muted-foreground">
              {Math.round(scale * 100)}% · {filteredRoots.length}{" "}
              {filteredRoots.length === 1 ? "raíz" : "raíces"}
            </span>
          </div>
          {exportMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                exportMutation.error,
                "No se pudo exportar el organigrama.",
              )}
            </p>
          ) : null}
          <OrgChartViewport
            scale={scale}
            pan={pan}
            onScaleChange={setScale}
            onPanChange={setPan}
          >
            <OrgChartTree
              companyName={chart.company.name}
              roots={filteredRoots}
              collapsedIds={collapsedIds}
              onToggle={toggle}
            />
          </OrgChartViewport>
            </>
          )}
        </div>
      )}
    </div>
  );
}
