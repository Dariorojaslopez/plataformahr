"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGES,
  formatDate,
  vacancyStatusVariant,
  VACANCY_STATUS_LABELS,
} from "@/lib/ats/labels";
import {
  canMoveApplication,
  getValidMoveTargets,
  moveRequiresComment,
} from "@/lib/ats/transitions";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ApplicationStage, PipelineCard } from "@/types/ats";
import { cn } from "@/lib/utils";

type PendingMove = {
  applicationId: string;
  fromStage: ApplicationStage;
  toStage: ApplicationStage;
  candidateName: string;
};

export function PipelinePageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const vacancyId = searchParams.get("vacancyId") ?? "";

  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [comment, setComment] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const vacanciesQuery = useQuery({
    queryKey: atsKeys.vacancies(companyId, { limit: 100 }),
    queryFn: () => atsApi.listVacancies({ page: 1, limit: 100 }),
  });

  const pipelineQuery = useQuery({
    queryKey: atsKeys.pipeline(companyId, vacancyId),
    queryFn: () => atsApi.getVacancyPipeline(vacancyId),
    enabled: Boolean(vacancyId),
  });

  const vacancyOptions = useMemo(
    () =>
      (vacanciesQuery.data?.items ?? [])
        .filter((v) => v.status === "OPEN" || v.status === "PAUSED")
        .map((v) => ({
          value: v.id,
          label: `${v.title} (${VACANCY_STATUS_LABELS[v.status]})`,
        })),
    [vacanciesQuery.data],
  );

  function setVacancy(nextId: string) {
    const sp = new URLSearchParams();
    if (nextId) sp.set("vacancyId", nextId);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const moveMutation = useMutation({
    mutationFn: ({
      applicationId,
      stage,
      comment: moveComment,
    }: {
      applicationId: string;
      stage: ApplicationStage;
      comment?: string;
    }) => atsApi.moveApplication(applicationId, { stage, comment: moveComment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.pipeline(companyId, vacancyId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.all(companyId),
      });
      setPendingMove(null);
      setComment("");
      setMoveError(null);
      notifySuccess("Aplicación movida de etapa");
    },
    onError: (error) => {
      setMoveError(getErrorMessage(error, "No se pudo mover la aplicación."));
      notifyError(error, "No se pudo mover la aplicación.");
    },
  });

  function requestMove(move: PendingMove) {
    if (moveMutation.isPending) return;
    setMoveError(null);
    if (moveRequiresComment(move.toStage)) {
      setPendingMove(move);
      setComment("");
      return;
    }
    moveMutation.mutate({
      applicationId: move.applicationId,
      stage: move.toStage,
    });
  }

  function onDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as PipelineCard | undefined;
    setActiveCard(card ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const card = event.active.data.current?.card as PipelineCard | undefined;
    const overId = event.over?.id;
    if (!card || typeof overId !== "string") return;
    if (!APPLICATION_STAGES.includes(overId as ApplicationStage)) return;
    const toStage = overId as ApplicationStage;
    if (toStage === card.stage) return;
    const allowed = getValidMoveTargets(card.stage);
    if (!allowed.includes(toStage)) return;
    requestMove({
      applicationId: card.applicationId,
      fromStage: card.stage,
      toStage,
      candidateName: card.candidateName,
    });
  }

  const columns = pipelineQuery.data?.columns ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Kanban de aplicaciones por vacante."
      />

      <FormSelect
        id="pipeline-vacancy"
        label="Vacante"
        value={vacancyId}
        onChange={setVacancy}
        options={vacancyOptions}
        placeholder="Seleccionar vacante"
        allowEmpty
        emptyLabel="Seleccionar…"
      />

      {!vacancyId ? (
        <EmptyState title="Selecciona una vacante para ver el pipeline." />
      ) : null}

      {vacancyId && pipelineQuery.isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {APPLICATION_STAGES.map((stage) => (
            <Skeleton key={stage} className="h-72 w-64 shrink-0" />
          ))}
        </div>
      ) : null}

      {pipelineQuery.isError ? (
        <ErrorState
          title="No se pudo cargar el pipeline"
          description={getErrorMessage(pipelineQuery.error, "Error al cargar.")}
          onRetry={() => void pipelineQuery.refetch()}
        />
      ) : null}

      {pipelineQuery.isSuccess ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {pipelineQuery.data.vacancy.title}
            </h2>
            <Badge
              variant={vacancyStatusVariant(pipelineQuery.data.vacancy.status)}
            >
              {VACANCY_STATUS_LABELS[pipelineQuery.data.vacancy.status]}
            </Badge>
          </div>

          {columns.every((c) => c.count === 0) ? (
            <EmptyState title="No hay candidatos en este proceso." />
          ) : null}

          {moveError && !pendingMove ? (
            <p className="text-sm text-destructive" role="alert">
              {moveError}
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveCard(null)}
          >
            <div className="flex gap-3 overflow-x-auto pb-2">
              {columns.map((column) => (
                <PipelineColumnView
                  key={column.stage}
                  stage={column.stage}
                  count={column.count}
                  cards={column.applications}
                  activeFromStage={activeCard?.stage ?? null}
                  onMoveRequest={(card, toStage) =>
                    requestMove({
                      applicationId: card.applicationId,
                      fromStage: card.stage,
                      toStage,
                      candidateName: card.candidateName,
                    })
                  }
                />
              ))}
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="w-64 rounded-md border border-border bg-card p-3 shadow-lg">
                  <p className="font-medium">{activeCard.candidateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCard.candidateEmail}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : null}

      <Dialog
        open={Boolean(pendingMove)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setComment("");
            setMoveError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mover a{" "}
              {pendingMove
                ? APPLICATION_STAGE_LABELS[pendingMove.toStage]
                : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingMove?.candidateName}
          </p>
          <div className="space-y-2">
            <Label htmlFor="move-comment">Comentario</Label>
            <Textarea
              id="move-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
          </div>
          {moveError ? (
            <p className="text-sm text-destructive" role="alert">
              {moveError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingMove(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={moveMutation.isPending}
              onClick={() => {
                if (!pendingMove) return;
                moveMutation.mutate({
                  applicationId: pendingMove.applicationId,
                  stage: pendingMove.toStage,
                  comment: comment.trim() || undefined,
                });
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function PipelineColumnView({
  stage,
  count,
  cards,
  activeFromStage,
  onMoveRequest,
}: {
  stage: ApplicationStage;
  count: number;
  cards: PipelineCard[];
  activeFromStage: ApplicationStage | null;
  onMoveRequest: (card: PipelineCard, toStage: ApplicationStage) => void;
}) {
  const acceptDrop =
    activeFromStage !== null &&
    getValidMoveTargets(activeFromStage).includes(stage);
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    disabled: activeFromStage !== null && !acceptDrop,
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={APPLICATION_STAGE_LABELS[stage]}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30",
        isOver && acceptDrop && "ring-2 ring-primary",
        activeFromStage && !acceptDrop && activeFromStage !== stage
          ? "opacity-50"
          : null,
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">
          {APPLICATION_STAGE_LABELS[stage]}
        </h3>
        <Badge variant="secondary">{count}</Badge>
      </header>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
        {cards.map((card) => (
          <PipelineCardView
            key={card.applicationId}
            card={card}
            onMoveRequest={onMoveRequest}
          />
        ))}
      </div>
    </section>
  );
}

function PipelineCardView({
  card,
  onMoveRequest,
}: {
  card: PipelineCard;
  onMoveRequest: (card: PipelineCard, toStage: ApplicationStage) => void;
}) {
  const targets = getValidMoveTargets(card.stage);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.applicationId,
      data: { card },
      disabled: !canMoveApplication(card.stage),
    });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className={cn(
        "rounded-md border border-border bg-card p-3 shadow-sm",
        isDragging && "opacity-40",
        canMoveApplication(card.stage) && "cursor-grab active:cursor-grabbing",
      )}
      {...(canMoveApplication(card.stage) ? { ...listeners, ...attributes } : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{card.candidateName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {card.candidateEmail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(card.lastStageChangedAt)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Acciones de aplicación"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/ats/applications/${card.applicationId}`}>
                Abrir aplicación
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/ats/candidates/${card.candidateId}`}>
                Ver candidato
              </Link>
            </DropdownMenuItem>
            {targets.map((stage) => (
              <DropdownMenuItem
                key={stage}
                onSelect={() => onMoveRequest(card, stage)}
              >
                Mover a {APPLICATION_STAGE_LABELS[stage]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
