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
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              Aceptación del colaborador
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
