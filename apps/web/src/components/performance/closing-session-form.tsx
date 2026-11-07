"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

type ClosingSessionData = Awaited<
  ReturnType<typeof performanceApi.getClosingSession>
>;

export function ClosingSessionForm({
  cycleId,
  employeeId,
  forceReadOnly = false,
}: {
  cycleId: string;
  employeeId?: string;
  forceReadOnly?: boolean;
}) {
  const companyId = useCompanyId();
  const query = useQuery({
    queryKey: performanceKeys.closing(companyId, cycleId, employeeId),
    queryFn: () => performanceApi.getClosingSession(cycleId, employeeId),
  });

  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        {getErrorMessage(query.error, "No se pudo cargar la sesión de cierre.")}
      </p>
    );
  }
  if (!query.data) return null;

  return (
    <ClosingSessionFormBody
      key={`${cycleId}-${employeeId ?? "self"}`}
      cycleId={cycleId}
      employeeId={employeeId}
      forceReadOnly={forceReadOnly}
      data={query.data}
    />
  );
}

function ClosingSessionFormBody({
  cycleId,
  employeeId,
  forceReadOnly,
  data,
}: {
  cycleId: string;
  employeeId?: string;
  forceReadOnly?: boolean;
  data: ClosingSessionData;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [collaborator, setCollaborator] = useState(
    data.collaboratorObservations ?? "",
  );
  const [leader, setLeader] = useState(data.leaderObservations ?? "");
  const [progressNotes, setProgressNotes] = useState(
    data.pdi?.progressNotes ?? "",
  );
  const [strengths, setStrengths] = useState(data.pdi?.strengths ?? "");
  const [improvements, setImprovements] = useState(
    data.pdi?.improvements ?? "",
  );
  const [strengthsOpportunities, setStrengthsOpportunities] = useState(
    data.strengthsOpportunities ?? "",
  );
  const [comments, setComments] = useState(data.comments ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      performanceApi.saveClosingSession(cycleId, {
        employeeId,
        collaboratorObservations: data.isSubject ? collaborator : undefined,
        leaderObservations: data.isSubject ? undefined : leader,
        pdiProgressPercent: data.pdi?.progressPercent ?? 0,
        pdiProgressNotes: progressNotes,
        pdiStrengths: strengths,
        pdiImprovements: improvements,
        strengthsOpportunities: data.isSubject ? strengthsOpportunities : undefined,
        comments: data.isSubject ? comments : undefined,
      }),
    onSuccess: async () => {
      notifySuccess("Sesión de cierre guardada");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.closing(companyId, cycleId, employeeId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo guardar el cierre."),
  });

  const acceptMutation = useMutation({
    mutationFn: () => performanceApi.acceptClosingSession(cycleId),
    onSuccess: async () => {
      notifySuccess("Cierre aceptado");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.closing(companyId, cycleId, employeeId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo aceptar el cierre."),
  });

  const leaderMutation = useMutation({
    mutationFn: () =>
      performanceApi.acceptClosingAsLeader(cycleId, data.employee.id),
    onSuccess: async () => {
      notifySuccess("El líder aceptó el cierre.");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.closing(companyId, cycleId, employeeId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo registrar la aceptación."),
  });

  const readOnly = forceReadOnly || Boolean(data.acceptedAt);

  return (
    <div className="space-y-4">
      {data.acceptedAt ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          El colaborador ya aceptó la sesión de cierre.
        </p>
      ) : null}

      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Resultado general</h3>
        <p className="text-sm">
          Overall: {data.result?.overallScore ?? "—"} · Competencias:{" "}
          {data.result?.competencyScore ?? "—"} · Objetivos:{" "}
          {data.result?.goalsAchievement ?? "—"}
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Resultados por objetivo</h3>
        {data.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin objetivos.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.goals.map((goal) => (
              <li key={goal.id}>
                <p className="font-medium">{goal.title}</p>
                {goal.ratings.map((rating) => (
                  <p key={rating.type} className="text-muted-foreground">
                    {rating.type}: {rating.label ?? rating.value ?? "—"}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.pdi ? (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">PDI</h3>
          <p className="text-sm font-medium">{data.pdi.name}</p>
          <div className="space-y-2">
            <Label htmlFor="close-notes">Avances</Label>
            <Textarea
              id="close-notes"
              value={progressNotes}
              disabled={readOnly || !data.canEditPdi}
              rows={3}
              onChange={(event) => setProgressNotes(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="close-strengths">Fortalezas</Label>
            <Textarea
              id="close-strengths"
              value={strengths}
              disabled={readOnly || !data.canEditPdi}
              rows={3}
              onChange={(event) => setStrengths(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="close-improvements">Oportunidades de mejora</Label>
            <Textarea
              id="close-improvements"
              value={improvements}
              disabled={readOnly || !data.canEditPdi}
              rows={3}
              onChange={(event) => setImprovements(event.target.value)}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-2">
          <Label htmlFor="close-strengths-opportunities">
            Fortalezas y oportunidades
          </Label>
          <Textarea
            id="close-strengths-opportunities"
            value={strengthsOpportunities}
            disabled={readOnly || !data.isSubject || !data.canEditObservations}
            rows={3}
            required
            onChange={(event) => setStrengthsOpportunities(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="close-comments">Comentarios</Label>
          <Textarea
            id="close-comments"
            value={comments}
            disabled={readOnly || !data.isSubject || !data.canEditObservations}
            rows={3}
            onChange={(event) => setComments(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="close-collab">Observaciones del colaborador</Label>
          <Textarea
            id="close-collab"
            value={collaborator}
            disabled={readOnly || !data.isSubject || !data.canEditObservations}
            rows={3}
            onChange={(event) => setCollaborator(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="close-leader">Observaciones del líder</Label>
          <Textarea
            id="close-leader"
            value={leader}
            disabled={readOnly || data.isSubject || !data.canEditObservations}
            rows={3}
            onChange={(event) => setLeader(event.target.value)}
          />
        </div>
      </section>

      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            Guardar
          </Button>
          {data.canAccept ? (
            <Button
              type="button"
              onClick={() => {
                if (!strengthsOpportunities.trim()) {
                  notifyError(
                    new Error("Completa fortalezas y oportunidades."),
                    "Completa fortalezas y oportunidades.",
                  );
                  return;
                }
                if (
                  window.confirm(
                    "Al confirmar el cierre de la evaluación aceptas que estás de acuerdo con los resultados obtenidos.",
                  )
                ) {
                  acceptMutation.mutate();
                }
              }}
              disabled={acceptMutation.isPending}
            >
              Aceptación del colaborador
            </Button>
          ) : null}
        </div>
      )}
      {data.canAcceptLeader ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => leaderMutation.mutate()}
          disabled={leaderMutation.isPending}
        >
          Aceptación del líder
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          printClosing(data, { strengthsOpportunities, comments })
        }
      >
        Exportar PDF
      </Button>
    </div>
  );
}

function printClosing(
  data: ClosingSessionData,
  extra: { strengthsOpportunities: string; comments: string },
) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return;
  const goals = data.goals
    .map(
      (goal) =>
        `<li><strong>${escapeHtml(goal.title)}</strong> (${escapeHtml(goal.type ?? "")}) ${
          goal.weight ? `peso ${escapeHtml(goal.weight)}` : ""
        } ${goal.ratings
          .map(
            (rating) =>
              `${escapeHtml(rating.type)}: ${escapeHtml(rating.label ?? String(rating.value ?? "—"))}`,
          )
          .join(", ")}</li>`,
    )
    .join("");
  popup.document.write(`<!doctype html><html><head><title>Resultado de evaluación</title></head><body>
    <h1>Resultado de evaluación</h1>
    <p>${escapeHtml(data.employee.firstName)} ${escapeHtml(data.employee.lastName)}</p>
    <p>Resultado general: ${escapeHtml(data.result?.overallScore ?? "—")}</p>
    <p>Competencias: ${escapeHtml(data.result?.competencyScore ?? "—")}</p>
    <p>Objetivos: ${escapeHtml(data.result?.goalsAchievement ?? "—")}</p>
    <h2>Objetivos</h2><ul>${goals}</ul>
    <h2>Fortalezas y oportunidades</h2><p>${escapeHtml(extra.strengthsOpportunities)}</p>
    ${extra.comments.trim() ? `<h2>Comentarios</h2><p>${escapeHtml(extra.comments)}</p>` : ""}
    <p>${data.acceptedAt ? "El colaborador aceptó los resultados obtenidos." : "Pendiente de aceptación del colaborador."}</p>
  </body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
