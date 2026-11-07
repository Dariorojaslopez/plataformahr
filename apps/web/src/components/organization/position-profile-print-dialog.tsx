"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompanyId } from "@/hooks/use-company-id";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  printPositionProfile,
  type PositionProfileCompetency,
  type PositionProfileDocument,
  type PositionProfileField,
} from "@/components/organization/position-profile-print";

export type PositionProfileRequest = {
  name: string;
  areaName: string;
  levelName: string | null;
  jobLevelId: string | null;
  reportsToName: string | null;
  headcount: string;
  statusLabel: string;
  mission: string;
  responsibilities: string;
  requiredExperience: string;
  requiredEducation: string;
  customFields: PositionProfileField[];
};

function competenciesNote(
  levelName: string | null,
  count: number,
  failed: boolean,
): string | null {
  if (failed) {
    return "No se pudieron cargar las competencias de este nivel.";
  }
  if (count > 0) return null;
  if (!levelName) {
    return "Este cargo no tiene nivel. Las competencias se definen en el nivel del cargo.";
  }
  return `El nivel ${levelName} no tiene competencias asignadas.`;
}

function ProfileBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const text = body.trim();
  if (!text) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </section>
  );
}

export function PositionProfilePrintDialog({
  request,
  onClose,
}: {
  request: PositionProfileRequest | null;
  onClose: () => void;
}) {
  const companyId = useCompanyId();
  const [printError, setPrintError] = useState<string | null>(null);
  const competenciesQuery = useQuery({
    queryKey: orgKeys.jobLevelCompetencies(
      companyId,
      request?.jobLevelId ?? "none",
    ),
    queryFn: () =>
      organizationApi.getJobLevelCompetencies(request!.jobLevelId!),
    enabled: Boolean(request?.jobLevelId),
  });

  const competencies: PositionProfileCompetency[] = (
    competenciesQuery.data?.assigned ?? []
  )
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({
      name: item.name,
      description: item.description?.trim() ? item.description : null,
    }));

  const waiting = Boolean(request?.jobLevelId) && competenciesQuery.isLoading;
  const failed = Boolean(request?.jobLevelId) && competenciesQuery.isError;
  const document: PositionProfileDocument | null = request
    ? {
        name: request.name,
        areaName: request.areaName,
        levelName: request.levelName,
        reportsToName: request.reportsToName,
        headcount: request.headcount,
        statusLabel: request.statusLabel,
        mission: request.mission,
        responsibilities: request.responsibilities,
        requiredExperience: request.requiredExperience,
        requiredEducation: request.requiredEducation,
        customFields: request.customFields,
        competencies: failed ? [] : competencies,
        competenciesNote: competenciesNote(
          request.levelName,
          failed ? 0 : competencies.length,
          failed,
        ),
      }
    : null;

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil del cargo</DialogTitle>
        </DialogHeader>
        {document ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-lg font-semibold">{document.name}</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Área</dt>
                  <dd>{document.areaName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Nivel</dt>
                  <dd>{document.levelName?.trim() || "Sin nivel"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Cargo al que reporta
                  </dt>
                  <dd>{document.reportsToName?.trim() || "Ninguno"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Plazas</dt>
                  <dd>{document.headcount || "—"}</dd>
                </div>
              </dl>
            </div>
            <ProfileBlock title="Misión" body={document.mission} />
            <ProfileBlock
              title="Responsabilidades"
              body={document.responsibilities}
            />
            <ProfileBlock
              title="Experiencia requerida"
              body={document.requiredExperience}
            />
            <ProfileBlock
              title="Educación requerida"
              body={document.requiredEducation}
            />
            {document.customFields.length > 0 ? (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Información adicional</h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {document.customFields.map((field) => (
                    <div key={field.label}>
                      <dt className="text-xs text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="whitespace-pre-wrap">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
            <section className="space-y-1">
              <h3 className="text-sm font-semibold">Competencias a evaluar</h3>
              {waiting ? (
                <p className="text-muted-foreground">Cargando competencias…</p>
              ) : document.competencies.length > 0 ? (
                <ol className="list-decimal space-y-2 pl-5">
                  {document.competencies.map((competency) => (
                    <li key={competency.name}>
                      <span className="font-medium">{competency.name}</span>
                      {competency.description ? (
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {competency.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">
                  {document.competenciesNote}
                </p>
              )}
            </section>
          </div>
        ) : null}
        {printError ? (
          <p className="text-sm text-destructive" role="alert">
            {printError}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            disabled={!document || waiting}
            onClick={() => {
              if (!document) return;
              setPrintError(null);
              const opened = printPositionProfile(document);
              if (!opened) {
                setPrintError(
                  "Permite ventanas emergentes para imprimir el perfil.",
                );
              }
            }}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
