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
import { FileText, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { hiringApi, hiringKeys } from "@/lib/api/hiring";
import { offerKeys, offersApi } from "@/lib/api/offers";
import {
  formatDate,
  vacancyStatusVariant,
  VACANCY_STATUS_LABELS,
} from "@/lib/ats/labels";
import {
  FIT_LEVEL_LABELS,
  KANBAN_COLUMNS,
  getValidKanbanTargets,
  groupCardsByKanbanColumn,
  hireRequirementChecks,
  kanbanColumnForStage,
  stageForKanbanColumn,
  type FitLevel,
  type KanbanColumnId,
} from "@/lib/ats/pipeline-kanban";
import { canMoveApplication, moveRequiresComment } from "@/lib/ats/transitions";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ApplicationStage, PipelineCard } from "@/types/ats";
import { cn } from "@/lib/utils";

type PendingMove = {
  applicationId: string;
  fromStage: ApplicationStage;
  toStage: ApplicationStage;
  candidateName: string;
};

const FIT_DOT_CLASS: Record<FitLevel, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
  gray: "bg-muted-foreground/40",
};

export function PipelinePageClient() {
  const companyId = useCompanyId();
  const { companyAccess } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const vacancyId = searchParams.get("vacancyId") ?? "";
  const pdiEnabled = (companyAccess?.enabledFeatures ?? []).includes(
    "premium.pdi",
  );

  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingHire, setPendingHire] = useState<PipelineCard | null>(null);
  const [resumeCard, setResumeCard] = useState<PipelineCard | null>(null);
  const [comment, setComment] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [hireDate, setHireDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [hireConfirmed, setHireConfirmed] = useState(false);

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

  const hirePrepQuery = useQuery({
    queryKey: [
      ...atsKeys.pipeline(companyId, vacancyId),
      "hire-prep",
      pendingHire?.applicationId,
    ],
    queryFn: async () => {
      const applicationId = pendingHire!.applicationId;
      const [application, vacancy, offer] = await Promise.all([
        atsApi.getApplication(applicationId),
        atsApi.getVacancy(vacancyId),
        offersApi.getByApplication(applicationId).catch((error) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }),
      ]);
      return { application, vacancy, offer };
    },
    enabled: Boolean(pendingHire && vacancyId),
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

  const kanbanCards = useMemo(() => {
    const cards = (pipelineQuery.data?.columns ?? []).flatMap(
      (column) => column.applications,
    );
    return groupCardsByKanbanColumn(cards);
  }, [pipelineQuery.data]);

  const hireChecks = useMemo(() => {
    const data = hirePrepQuery.data;
    if (!data) return [];
    return hireRequirementChecks({
      stage: data.application.stage,
      offerStatus: data.offer?.status ?? null,
      headcount: data.vacancy.headcount,
      filledCount: data.vacancy.filledCount,
    });
  }, [hirePrepQuery.data]);

  const canConfirmHire = hireChecks.length > 0 && hireChecks.every((c) => c.met);

  function setVacancy(nextId: string) {
    const sp = new URLSearchParams();
    if (nextId) sp.set("vacancyId", nextId);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function invalidatePipeline() {
    await queryClient.invalidateQueries({
      queryKey: atsKeys.pipeline(companyId, vacancyId),
    });
    await queryClient.invalidateQueries({
      queryKey: atsKeys.all(companyId),
    });
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
      await invalidatePipeline();
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

  const hireMutation = useMutation({
    mutationFn: (applicationId: string) =>
      hiringApi.hire(applicationId, {
        hireDate: hireDate || undefined,
      }),
    onSuccess: async () => {
      await invalidatePipeline();
      await queryClient.invalidateQueries({
        queryKey: hiringKeys.all(companyId),
      });
      await queryClient.invalidateQueries({
        queryKey: offerKeys.all(companyId),
      });
      setPendingHire(null);
      setHireConfirmed(false);
      notifySuccess(
        pdiEnabled
          ? "Contratación registrada. El PDI se generará cuando el módulo de Performance esté disponible."
          : "Contratación registrada",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo registrar la contratación.");
    },
  });

  function requestKanbanMove(card: PipelineCard, columnId: KanbanColumnId) {
    if (moveMutation.isPending || hireMutation.isPending) return;
    const currentColumn = kanbanColumnForStage(card.stage);
    if (currentColumn === columnId) return;
    if (!getValidKanbanTargets(card.stage).includes(columnId)) return;
    if (columnId === "HIRED") {
      setPendingHire(card);
      setHireConfirmed(false);
      setHireDate(new Date().toISOString().slice(0, 10));
      return;
    }
    requestMove({
      applicationId: card.applicationId,
      fromStage: card.stage,
      toStage: stageForKanbanColumn(columnId),
      candidateName: card.candidateName,
    });
  }

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

  function requestDiscard(card: PipelineCard) {
    requestMove({
      applicationId: card.applicationId,
      fromStage: card.stage,
      toStage: "REJECTED",
      candidateName: card.candidateName,
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
    if (!KANBAN_COLUMNS.some((column) => column.id === overId)) return;
    requestKanbanMove(card, overId as KanbanColumnId);
  }

  const visibleCount = KANBAN_COLUMNS.reduce(
    (sum, column) => sum + kanbanCards[column.id].length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Tablero Kanban de candidatos por proceso de selección."
      />

      <FormSelect
        id="pipeline-vacancy"
        label="Proceso de selección"
        value={vacancyId}
        onChange={setVacancy}
        options={vacancyOptions}
        placeholder="Seleccionar proceso"
        allowEmpty
        emptyLabel="Seleccionar…"
      />

      {!vacancyId ? (
        <EmptyState title="Selecciona una vacante para ver el pipeline." />
      ) : null}

      {vacancyId && pipelineQuery.isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {KANBAN_COLUMNS.map((column) => (
            <Skeleton key={column.id} className="h-72 w-64 shrink-0" />
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

          {visibleCount === 0 ? (
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
              {KANBAN_COLUMNS.map((column) => (
                <PipelineColumnView
                  key={column.id}
                  columnId={column.id}
                  label={column.label}
                  dropHint={column.dropHint}
                  cards={kanbanCards[column.id]}
                  activeFromStage={activeCard?.stage ?? null}
                  onMoveRequest={requestKanbanMove}
                  onDiscard={requestDiscard}
                  onOpenResume={setResumeCard}
                />
              ))}
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="w-64 rounded-md border border-border bg-card p-3 shadow-lg">
                  <PipelineCardHeader card={activeCard} />
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
              {pendingMove?.toStage === "REJECTED"
                ? "Descartar candidato"
                : "Mover candidato"}
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

      <Dialog
        open={Boolean(pendingHire)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingHire(null);
            setHireConfirmed(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Requisitos para contratar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingHire?.candidateName}
          </p>
          {hirePrepQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : null}
          {hirePrepQuery.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                hirePrepQuery.error,
                "No se pudieron validar los requisitos.",
              )}
            </p>
          ) : null}
          {hirePrepQuery.isSuccess ? (
            <ul className="space-y-2">
              {hireChecks.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      item.met ? "bg-emerald-500" : "bg-red-500",
                    )}
                    aria-hidden
                  />
                  <span>
                    {item.label}
                    {item.met ? "" : " — pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {!canConfirmHire && hirePrepQuery.isSuccess ? (
            <p className="text-sm text-muted-foreground">
              Completa la oferta y el cupo de la vacante antes de contratar. La
              contratación formal no se puede saltar.
            </p>
          ) : null}
          {canConfirmHire ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pipeline-hire-date">Fecha de ingreso</Label>
                <Input
                  id="pipeline-hire-date"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={hireConfirmed}
                  onCheckedChange={(value) =>
                    setHireConfirmed(value === true)
                  }
                  aria-label="Confirmar requisitos de contratación"
                />
                <span>
                  Confirmo que se cumplieron los requisitos para contratar a
                  este candidato.
                </span>
              </label>
              {pdiEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Al contratar se programará la generación del PDI en
                  Performance cuando el módulo esté disponible.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingHire(null)}
            >
              Cancelar
            </Button>
            {hirePrepQuery.isSuccess && pendingHire && !canConfirmHire ? (
              <Button asChild>
                <Link href={`/ats/applications/${pendingHire.applicationId}`}>
                  Abrir aplicación
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  !canConfirmHire ||
                  !hireConfirmed ||
                  hireMutation.isPending ||
                  !pendingHire
                }
                onClick={() => {
                  if (!pendingHire) return;
                  hireMutation.mutate(pendingHire.applicationId);
                }}
              >
                Contratar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resumeCard)}
        onOpenChange={(open) => {
          if (!open) setResumeCard(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hoja de vida</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resumeCard?.hasCv
              ? `Descarga la hoja de vida de ${resumeCard.candidateName}.`
              : resumeCard
                ? `No hay una hoja de vida cargada para ${resumeCard.candidateName}. Puedes revisar el perfil del candidato.`
                : null}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResumeCard(null)}>
              Cerrar
            </Button>
            {resumeCard?.hasCv ? (
              <Button
                type="button"
                onClick={() => void downloadCandidateCv(resumeCard.candidateId)}
              >
                Descargar HV
              </Button>
            ) : null}
            {resumeCard ? (
              <Button asChild>
                <Link href={`/ats/candidates/${resumeCard.candidateId}`}>
                  Ver perfil
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PipelineColumnView({
  columnId,
  label,
  dropHint,
  cards,
  activeFromStage,
  onMoveRequest,
  onDiscard,
  onOpenResume,
}: {
  columnId: KanbanColumnId;
  label: string;
  dropHint: string;
  cards: PipelineCard[];
  activeFromStage: ApplicationStage | null;
  onMoveRequest: (card: PipelineCard, columnId: KanbanColumnId) => void;
  onDiscard: (card: PipelineCard) => void;
  onOpenResume: (card: PipelineCard) => void;
}) {
  const acceptDrop =
    activeFromStage !== null &&
    getValidKanbanTargets(activeFromStage).includes(columnId);
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    disabled: activeFromStage !== null && !acceptDrop,
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30",
        isOver && acceptDrop && "ring-2 ring-primary",
        activeFromStage && !acceptDrop && kanbanColumnForStage(activeFromStage) !== columnId
          ? "opacity-50"
          : null,
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="secondary">{cards.length}</Badge>
      </header>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {dropHint}
          </p>
        ) : null}
        {cards.map((card) => (
          <PipelineCardView
            key={card.applicationId}
            card={card}
            onMoveRequest={onMoveRequest}
            onDiscard={onDiscard}
            onOpenResume={onOpenResume}
          />
        ))}
      </div>
    </section>
  );
}

function PipelineCardView({
  card,
  onMoveRequest,
  onDiscard,
  onOpenResume,
}: {
  card: PipelineCard;
  onMoveRequest: (card: PipelineCard, columnId: KanbanColumnId) => void;
  onDiscard: (card: PipelineCard) => void;
  onOpenResume: (card: PipelineCard) => void;
}) {
  const targets = getValidKanbanTargets(card.stage);
  const draggable = targets.length > 0;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.applicationId,
      data: { card },
      disabled: !draggable,
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
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <PipelineCardHeader card={card} />
        <div className="flex shrink-0 items-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Ver hoja de vida"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenResume(card)}
          >
            <FileText className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
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
              {(card.stage === "INTERVIEW" || card.stage === "OFFER") && (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/ats/interviews?applicationId=${card.applicationId}`}
                  >
                    Ver entrevistas
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onOpenResume(card)}>
                Hoja de vida
              </DropdownMenuItem>
              {targets.map((columnId) => (
                <DropdownMenuItem
                  key={columnId}
                  onSelect={() => onMoveRequest(card, columnId)}
                >
                  Mover a{" "}
                  {KANBAN_COLUMNS.find((column) => column.id === columnId)
                    ?.label}
                </DropdownMenuItem>
              ))}
              {canMoveApplication(card.stage) &&
              card.stage !== "HIRED" ? (
                <DropdownMenuItem onSelect={() => onDiscard(card)}>
                  Descartar
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

function PipelineCardHeader({ card }: { card: PipelineCard }) {
  const fitLevel = card.fitLevel ?? "gray";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2.5 shrink-0 rounded-full", FIT_DOT_CLASS[fitLevel])}
          title={FIT_LEVEL_LABELS[fitLevel]}
          aria-label={FIT_LEVEL_LABELS[fitLevel]}
        />
        <p className="truncate font-medium">{card.candidateName}</p>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {card.candidateEmail}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(card.lastStageChangedAt)}
      </p>
    </div>
  );
}

async function downloadCandidateCv(candidateId: string) {
  try {
    const file = await atsApi.downloadCandidateCv(candidateId);
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename || "hoja-de-vida";
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    notifyError(error, "No se pudo descargar la hoja de vida.");
  }
}
