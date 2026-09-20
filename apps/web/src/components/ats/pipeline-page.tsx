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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { companyApi, companyKeys } from "@/lib/api/company";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { hiringApi, hiringKeys, type HirePdiSyncResult } from "@/lib/api/hiring";
import { offerKeys, offersApi } from "@/lib/api/offers";
import {
  formatDate,
  PRE_HIRE_CHECK_STATUS_LABELS,
  vacancyStatusVariant,
  VACANCY_STATUS_LABELS,
} from "@/lib/ats/labels";
import {
  FIT_LEVEL_LABELS,
  KANBAN_COLUMNS,
  finalistCardsForDocs,
  finalistHireDocumentsBlockedMessage,
  getValidKanbanTargets,
  groupCardsByKanbanColumn,
  hireRequirementChecks,
  isReadyToCreateCollaborator,
  kanbanColumnForStage,
  missingFinalistHireDocuments,
  stageForKanbanColumn,
  type FitLevel,
  type KanbanColumnId,
} from "@/lib/ats/pipeline-kanban";
import { canMoveApplication, moveRequiresComment } from "@/lib/ats/transitions";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  ApplicationStage,
  PipelineCard,
  PreHireDocumentKind,
} from "@/types/ats";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PendingMove = {
  applicationId: string;
  fromStage: ApplicationStage;
  toStage: ApplicationStage;
  candidateName: string;
  card?: PipelineCard;
};

const PREHIRE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const PREHIRE_UPLOAD_ACCEPT =
  ".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";
const CV_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const CV_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const INTERNAL_CANDIDATE_SOURCE = "INTERNAL_HOME";
const OFFER_LETTER_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const OFFER_LETTER_UPLOAD_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type OfferLetterApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

function filledOfferLetterStatusLabel(
  hasFile: boolean,
  status?: OfferLetterApprovalStatus | null,
): string {
  if (!hasFile) return "Pendiente de carga";
  if (status === "PENDING") return "En aprobación";
  if (status === "APPROVED") return "Aprobada";
  if (status === "REJECTED") return "Rechazada";
  return "Diligenciada";
}

function filledContractStatusLabel(
  hasFile: boolean,
  status?: OfferLetterApprovalStatus | null,
): string {
  if (!hasFile) return "Pendiente de carga";
  if (status === "PENDING") return "En aprobación";
  if (status === "APPROVED") return "Aprobado";
  if (status === "REJECTED") return "Rechazado";
  return "Diligenciado";
}

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
  const offerLetterInputRef = useRef<HTMLInputElement>(null);
  const offerLetterTargetRef = useRef<PipelineCard | null>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);
  const contractTargetRef = useRef<PipelineCard | null>(null);

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

  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });
  const companyHasOfferLetterTemplate = Boolean(
    companyQuery.data?.hasOfferLetterTemplate ||
      companyQuery.data?.offerLetterTemplateOriginalName ||
      pipelineQuery.data?.hasCompanyOfferLetterTemplate,
  );
  const companyHasContractTemplate = Boolean(
    companyQuery.data?.hasContractTemplate ||
      companyQuery.data?.contractTemplateOriginalName ||
      pipelineQuery.data?.hasCompanyContractTemplate,
  );

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
      const letter = offer
        ? await offersApi.getLetterStatus(offer.id).catch(() => null)
        : null;
      return { application, vacancy, offer, letter };
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
    const cards = (pipelineQuery.data?.columns ?? []).flatMap((column) =>
      column.applications.map((card) => ({
        ...card,
        hasCompanyOfferLetterTemplate:
          Boolean(card.hasCompanyOfferLetterTemplate) ||
          companyHasOfferLetterTemplate,
        hasCompanyContractTemplate:
          Boolean(card.hasCompanyContractTemplate) ||
          companyHasContractTemplate,
      })),
    );
    return groupCardsByKanbanColumn(cards);
  }, [
    companyHasContractTemplate,
    companyHasOfferLetterTemplate,
    pipelineQuery.data,
  ]);

  const hireChecks = useMemo(() => {
    const data = hirePrepQuery.data;
    if (!data) return [];
    return hireRequirementChecks({
      stage: data.application.stage,
      offerStatus: data.offer?.status ?? null,
      headcount: data.vacancy.headcount,
      filledCount: data.vacancy.filledCount,
      hasCv: Boolean(data.application.candidate?.cvFileName),
      hasSecurityStudyDoc: Boolean(
        data.application.preHireDocuments?.some(
          (doc) => doc.kind === "SECURITY_STUDY",
        ),
      ),
      hasMedicalExamDoc: Boolean(
        data.application.preHireDocuments?.some(
          (doc) => doc.kind === "MEDICAL_EXAM",
        ),
      ),
      contractApprovalStatus: data.offer?.contractApprovalStatus,
      hasCompanyOfferLetterTemplate: data.letter?.hasCompanyTemplate,
      hasSignedOfferLetter: data.letter?.hasSignedLetter,
      offerLetterApprovalStatus: data.letter?.offerLetterApprovalStatus,
      offerLetterSentAt: data.letter?.offerLetterSentAt,
      offerLetterSendMode: data.letter?.offerLetterSendMode,
      offerLetterCandidateSignedAt: data.letter?.offerLetterCandidateSignedAt,
    });
  }, [hirePrepQuery.data]);

  const canConfirmHire = hireChecks.length > 0 && hireChecks.every((c) => c.met);

  function setVacancy(nextId: string) {
    const sp = new URLSearchParams();
    if (nextId) sp.set("vacancyId", nextId);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const didAutoSelectVacancy = useRef(false);
  useEffect(() => {
    if (didAutoSelectVacancy.current || vacancyId) return;
    const firstVacancyId = vacancyOptions[0]?.value;
    if (!firstVacancyId) return;
    didAutoSelectVacancy.current = true;
    setVacancy(firstVacancyId);
  }, [vacancyId, vacancyOptions]);

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
      card?: PipelineCard;
    }) => atsApi.moveApplication(applicationId, { stage, comment: moveComment }),
    onSuccess: async (_data, vars) => {
      const openedCard =
        vars.stage === "OFFER"
          ? (vars.card ?? pendingMove?.card ?? null)
          : null;
      await invalidatePipeline();
      setPendingMove(null);
      setComment("");
      setMoveError(null);
      notifySuccess("Aplicación movida de etapa");
      if (openedCard) {
        setResumeCard({ ...openedCard, stage: "OFFER" });
      }
    },
    onError: (error) => {
      setMoveError(getErrorMessage(error, "No se pudo mover la aplicación."));
      notifyError(error, "No se pudo mover la aplicación.");
    },
  });

  const uploadCvMutation = useMutation({
    mutationFn: async ({
      candidateId,
      file,
    }: {
      candidateId: string;
      applicationId: string;
      file: File;
    }) => {
      if (file.size > CV_UPLOAD_MAX_BYTES) {
        throw new Error("La hoja de vida supera el tamaño máximo (15 MB).");
      }
      return atsApi.uploadCandidateCv(candidateId, file);
    },
    onSuccess: async (_data, vars) => {
      await invalidatePipeline();
      setResumeCard((current) => {
        if (!current || current.applicationId !== vars.applicationId) {
          return current;
        }
        return { ...current, hasCv: true };
      });
      notifySuccess("Hoja de vida cargada");
    },
    onError: (error) => {
      notifyError(error, "No se pudo cargar la hoja de vida.");
    },
  });

  const uploadPreHireMutation = useMutation({
    mutationFn: async ({
      applicationId,
      kind,
      file,
    }: {
      applicationId: string;
      kind: PreHireDocumentKind;
      file: File;
    }) => {
      if (file.size > PREHIRE_UPLOAD_MAX_BYTES) {
        throw new Error("El documento supera el tamaño máximo (20 MB).");
      }
      return hiringApi.uploadPreHireDocument(applicationId, kind, file);
    },
    onSuccess: async (_data, vars) => {
      await invalidatePipeline();
      setResumeCard((current) => {
        if (!current || current.applicationId !== vars.applicationId) {
          return current;
        }
        return {
          ...current,
          hasSecurityStudyDoc:
            vars.kind === "SECURITY_STUDY"
              ? true
              : current.hasSecurityStudyDoc,
          hasMedicalExamDoc:
            vars.kind === "MEDICAL_EXAM" ? true : current.hasMedicalExamDoc,
        };
      });
      notifySuccess("Documento cargado");
    },
    onError: (error) => {
      notifyError(error, "No se pudo cargar el documento.");
    },
  });

  const uploadOfferLetterMutation = useMutation({
    mutationFn: async ({
      applicationId,
      file,
    }: {
      applicationId: string;
      file: File;
    }) => {
      if (file.size > OFFER_LETTER_UPLOAD_MAX_BYTES) {
        throw new Error("La carta oferta supera el tamaño máximo (10 MB).");
      }
      return offersApi.uploadFilledLetter(applicationId, file);
    },
    onSuccess: async (data, vars) => {
      await invalidatePipeline();
      setResumeCard((current) => {
        if (!current || current.applicationId !== vars.applicationId) {
          return current;
        }
        return {
          ...current,
          jobOfferId: data.offerId,
          hasSignedOfferLetter: true,
          hasCompanyOfferLetterTemplate:
            current.hasCompanyOfferLetterTemplate || data.hasCompanyTemplate,
          offerLetterApprovalStatus: data.offerLetterApprovalStatus ?? null,
        };
      });
      notifySuccess(
        data.offerLetterApprovalStatus === "PENDING"
          ? "Carta oferta cargada. El aprobador de carta oferta ya puede revisarla en su inicio."
          : data.offerLetterApprovalStatus === "NOT_REQUIRED"
            ? "Carta oferta cargada. Configura un aprobador de carta oferta en ATS para iniciar el flujo."
            : "Carta oferta cargada",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo cargar la carta oferta.");
    },
  });

  const uploadContractMutation = useMutation({
    mutationFn: async ({
      applicationId,
      file,
    }: {
      applicationId: string;
      file: File;
    }) => {
      if (file.size > OFFER_LETTER_UPLOAD_MAX_BYTES) {
        throw new Error("El contrato supera el tamaño máximo (10 MB).");
      }
      return offersApi.uploadFilledContract(applicationId, file);
    },
    onSuccess: async (data) => {
      await invalidatePipeline();
      notifySuccess(
        data.contractApprovalStatus === "PENDING"
          ? "Contrato cargado. El aprobador de contrato ya puede revisarlo en su inicio."
          : data.contractApprovalStatus === "NOT_REQUIRED"
            ? "Contrato cargado y enviado. Configura un aprobador de contrato en ATS para exigir aprobación."
            : "Contrato cargado",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo cargar el contrato.");
    },
  });

  const toHireMutation = useMutation({
    mutationFn: (applicationId: string) =>
      hiringApi.advanceToHire(applicationId, {
        hireDate: hireDate || undefined,
      }),
    onSuccess: async () => {
      await invalidatePipeline();
      setPendingHire(null);
      setHireConfirmed(false);
      notifySuccess(
        "Candidato en A Contratar. Carga el contrato para iniciar la firma; aún no se crea el colaborador.",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo pasar a A Contratar.");
    },
  });

  const hireMutation = useMutation({
    mutationFn: (applicationId: string) =>
      hiringApi.hire(applicationId, {
        hireDate: hireDate || undefined,
      }),
    onSuccess: async (hiring) => {
      await invalidatePipeline();
      await queryClient.invalidateQueries({
        queryKey: hiringKeys.all(companyId),
      });
      await queryClient.invalidateQueries({
        queryKey: offerKeys.all(companyId),
      });
      setPendingHire(null);
      setHireConfirmed(false);
      notifySuccess(pipelinePdiHireMessage(hiring.pdi, pdiEnabled));
    },
    onError: (error) => {
      notifyError(error, "No se pudo registrar la contratación.");
    },
  });

  function requestKanbanMove(card: PipelineCard, columnId: KanbanColumnId) {
    if (moveMutation.isPending || hireMutation.isPending || toHireMutation.isPending)
      return;
    const currentColumn = kanbanColumnForStage(card.stage);
    if (currentColumn === columnId) return;
    if (!getValidKanbanTargets(card.stage).includes(columnId)) return;
    if (columnId === "HIRED") {
      const missingDocs = missingFinalistHireDocuments(card);
      if (missingDocs.length > 0) {
        notifyError(
          new Error(finalistHireDocumentsBlockedMessage(missingDocs)),
          finalistHireDocumentsBlockedMessage(missingDocs),
        );
        setResumeCard(card);
        return;
      }
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
      card,
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
      card: move.card,
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

  async function downloadOfferTemplate() {
    try {
      const { blob, filename } = await companyApi.downloadAtsTemplate(
        "offer-letter",
      );
      triggerBlobDownload(blob, filename || "carta-oferta.docx");
    } catch (error) {
      notifyError(error, "No se pudo descargar la plantilla de carta oferta.");
    }
  }

  function requestOfferLetterUpload(card: PipelineCard) {
    if (card.stage !== "OFFER") {
      notifyError(
        new Error("Solo puedes cargar la carta oferta en Finalistas."),
        "Solo puedes cargar la carta oferta en Finalistas.",
      );
      return;
    }
    offerLetterTargetRef.current = card;
    offerLetterInputRef.current?.click();
  }

  function requestContractUpload(card: PipelineCard) {
    if (card.stage !== "TO_HIRE") {
      notifyError(
        new Error("Solo puedes cargar el contrato en A Contratar."),
        "Solo puedes cargar el contrato en A Contratar.",
      );
      return;
    }
    contractTargetRef.current = card;
    contractInputRef.current?.click();
  }

  async function downloadContractTemplate() {
    try {
      const { blob, filename } = await companyApi.downloadAtsTemplate(
        "contract",
      );
      triggerBlobDownload(blob, filename || "contrato.docx");
    } catch (error) {
      notifyError(error, "No se pudo descargar la plantilla de contrato.");
    }
  }

  async function downloadFilledOfferLetter(card: PipelineCard) {
    try {
      const { blob, filename } = await offersApi.downloadFilledLetter(
        card.applicationId,
      );
      triggerBlobDownload(blob, filename || "carta-oferta");
    } catch (error) {
      notifyError(error, "No se pudo descargar la carta oferta.");
    }
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
  const finalistDocsRows = useMemo(
    () => finalistCardsForDocs(Object.values(kanbanCards).flat()),
    [kanbanCards],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tablero Kanban"
        description="Avance de candidatos por proceso de selección."
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
        <div className="space-y-3">
          <EmptyState title="Selecciona un proceso de selección para ver el avance de los candidatos." />
          <KanbanColumnsPreview />
        </div>
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
          title="No se pudo cargar el tablero"
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
                  onDownloadOfferTemplate={downloadOfferTemplate}
                  onUploadOfferLetter={requestOfferLetterUpload}
                  uploadingOfferLetter={uploadOfferLetterMutation.isPending}
                  onDownloadContractTemplate={downloadContractTemplate}
                  onUploadContract={requestContractUpload}
                  uploadingContract={uploadContractMutation.isPending}
                  onCreateCollaborator={(card) => {
                    setHireDate(new Date().toISOString().slice(0, 10));
                    hireMutation.mutate(card.applicationId);
                  }}
                  creatingCollaborator={hireMutation.isPending}
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

          <input
            ref={offerLetterInputRef}
            type="file"
            accept={OFFER_LETTER_UPLOAD_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              const card = offerLetterTargetRef.current;
              offerLetterTargetRef.current = null;
              if (!file || !card) return;
              uploadOfferLetterMutation.mutate({
                applicationId: card.applicationId,
                file,
              });
            }}
          />

          <input
            ref={contractInputRef}
            type="file"
            accept={OFFER_LETTER_UPLOAD_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              const card = contractTargetRef.current;
              contractTargetRef.current = null;
              if (!file || !card) return;
              uploadContractMutation.mutate({
                applicationId: card.applicationId,
                file,
              });
            }}
          />

          <RecruiterDocsTable
            cards={finalistDocsRows}
            onOpenDocs={setResumeCard}
            onDownloadOfferTemplate={downloadOfferTemplate}
            onUploadOfferLetter={requestOfferLetterUpload}
            onDownloadFilledOfferLetter={downloadFilledOfferLetter}
            uploadingOfferLetter={uploadOfferLetterMutation.isPending}
          />
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
                  card: pendingMove.card,
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
            <DialogTitle>Pasar a A Contratar</DialogTitle>
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
            <div className="space-y-2 text-sm text-muted-foreground">
              {hireChecks.some(
                (item) => item.id === "VACANCY_CAPACITY" && !item.met,
              ) ? (
                <p>
                  Este proceso y el cargo ya no tienen plazas libres. Si
                  agregaste cajas vacías en el organigrama, recarga el tablero
                  para que este proceso las tome.
                </p>
              ) : (
                <p>
                  Completa HV, estudio de seguridad, exámenes médicos y la
                  carta oferta. Si la carta ya fue aprobada, puedes pasar a
                  A Contratar. El colaborador se crea después de la firma de
                  contrato. Si falta un requisito, el candidato permanece en
                  Finalistas.
                </p>
              )}
            </div>
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
                  Confirmo que se cumplieron los requisitos para pasar a
                  A Contratar a este candidato. Aún no se crea el colaborador.
                </span>
              </label>
              {pdiEnabled ? (
                <p className="text-xs text-muted-foreground">
                  El PDI se genera al crear el colaborador, después de firmar
                  el contrato.
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
                  toHireMutation.isPending ||
                  !pendingHire
                }
                onClick={() => {
                  if (!pendingHire) return;
                  toHireMutation.mutate(pendingHire.applicationId);
                }}
              >
                {toHireMutation.isPending ? "Moviendo…" : "Pasar a A Contratar"}
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
            <DialogTitle>Documentos del candidato</DialogTitle>
          </DialogHeader>
          {resumeCard ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {resumeCard.stage === "OFFER"
                  ? `${resumeCard.candidateName} · HV (PDF/DOC/DOCX/TXT, máx. 15 MB), pre-contratación (máx. 20 MB) y carta oferta (PDF o DOCX, máx. 10 MB). La carta solo se gestiona en Finalistas. Al cargar la diligenciada se inicia la aprobación.`
                  : `${resumeCard.candidateName} · HV (PDF/DOC/DOCX/TXT, máx. 15 MB) y pre-contratación (máx. 20 MB). La carta oferta se gestiona cuando el candidato esté en Finalistas.`}
              </p>
              <ul className="space-y-2 text-sm">
                <DocDownloadRow
                  label="Hoja de vida"
                  available={Boolean(resumeCard.hasCv)}
                  statusLabel={
                    !resumeCard.hasCv &&
                    resumeCard.source === INTERNAL_CANDIDATE_SOURCE
                      ? "Candidato interno"
                      : undefined
                  }
                  onDownload={() =>
                    void downloadCandidateCv(resumeCard.candidateId)
                  }
                  onUpload={
                    resumeCard.source === INTERNAL_CANDIDATE_SOURCE ||
                    !resumeCard.hasCv
                      ? (file) =>
                          uploadCvMutation.mutate({
                            candidateId: resumeCard.candidateId,
                            applicationId: resumeCard.applicationId,
                            file,
                          })
                      : undefined
                  }
                  accept={CV_UPLOAD_ACCEPT}
                  maxBytes={CV_UPLOAD_MAX_BYTES}
                  uploading={uploadCvMutation.isPending}
                />
                <DocDownloadRow
                  label="Estudio de seguridad"
                  available={Boolean(resumeCard.hasSecurityStudyDoc)}
                  statusLabel={
                    resumeCard.securityStudyStatus
                      ? PRE_HIRE_CHECK_STATUS_LABELS[
                          resumeCard.securityStudyStatus
                        ]
                      : undefined
                  }
                  onDownload={() =>
                    void downloadPreHireDoc(
                      resumeCard.applicationId,
                      "SECURITY_STUDY",
                    )
                  }
                  onUpload={(file) =>
                    uploadPreHireMutation.mutate({
                      applicationId: resumeCard.applicationId,
                      kind: "SECURITY_STUDY",
                      file,
                    })
                  }
                  uploading={uploadPreHireMutation.isPending}
                />
                <DocDownloadRow
                  label="Exámenes médicos"
                  available={Boolean(resumeCard.hasMedicalExamDoc)}
                  statusLabel={
                    resumeCard.medicalExamStatus
                      ? PRE_HIRE_CHECK_STATUS_LABELS[
                          resumeCard.medicalExamStatus
                        ]
                      : undefined
                  }
                  onDownload={() =>
                    void downloadPreHireDoc(
                      resumeCard.applicationId,
                      "MEDICAL_EXAM",
                    )
                  }
                  onUpload={(file) =>
                    uploadPreHireMutation.mutate({
                      applicationId: resumeCard.applicationId,
                      kind: "MEDICAL_EXAM",
                      file,
                    })
                  }
                  uploading={uploadPreHireMutation.isPending}
                />
                {resumeCard.stage === "OFFER" ? (
                  <>
                    <DocDownloadRow
                      label="Plantilla de carta oferta"
                      available
                      statusLabel={
                        companyQuery.data?.offerLetterTemplateOriginalName ??
                        "Word configurada en ATS"
                      }
                      onDownload={() => void downloadOfferTemplate()}
                    />
                    <DocDownloadRow
                      label="Carta oferta diligenciada"
                      available={Boolean(resumeCard.hasSignedOfferLetter)}
                      statusLabel={filledOfferLetterStatusLabel(
                        Boolean(resumeCard.hasSignedOfferLetter),
                        resumeCard.offerLetterApprovalStatus,
                      )}
                      onDownload={() =>
                        void downloadFilledOfferLetter(resumeCard)
                      }
                      extraActions={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadOfferLetterMutation.isPending}
                          onClick={() =>
                            requestOfferLetterUpload(resumeCard)
                          }
                        >
                          {uploadOfferLetterMutation.isPending
                            ? "Subiendo…"
                            : resumeCard.hasSignedOfferLetter
                              ? "Reemplazar"
                              : "Cargar carta"}
                        </Button>
                      }
                    />
                  </>
                ) : null}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResumeCard(null)}>
              Cerrar
            </Button>
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

function RecruiterDocsTable({
  cards,
  onOpenDocs,
  onDownloadOfferTemplate,
  onUploadOfferLetter,
  onDownloadFilledOfferLetter,
  uploadingOfferLetter,
}: {
  cards: PipelineCard[];
  onOpenDocs: (card: PipelineCard) => void;
  onDownloadOfferTemplate: () => void;
  onUploadOfferLetter: (card: PipelineCard) => void;
  onDownloadFilledOfferLetter: (card: PipelineCard) => void;
  uploadingOfferLetter: boolean;
}) {
  if (cards.length === 0) return null;

  return (
    <section className="space-y-3 rounded-md border border-border p-4">
      <div>
        <h3 className="text-base font-semibold">Documentos · Finalistas</h3>
        <p className="text-sm text-muted-foreground">
          HV, estudio de seguridad, exámenes médicos y carta oferta
          diligenciada. Deben estar cargados para pasar a Contratar.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidato</TableHead>
            <TableHead>HV</TableHead>
            <TableHead>Seguridad</TableHead>
            <TableHead>Médicos</TableHead>
            <TableHead>Carta oferta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => (
            <TableRow key={card.applicationId}>
              <TableCell>
                <div className="font-medium">{card.candidateName}</div>
                <div className="text-xs text-muted-foreground">
                  {card.candidateEmail}
                </div>
              </TableCell>
              <TableCell>
                <DocAvailability
                  available={Boolean(card.hasCv)}
                  onDownload={() => void downloadCandidateCv(card.candidateId)}
                />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <DocAvailability
                    available={Boolean(card.hasSecurityStudyDoc)}
                    onDownload={() =>
                      void downloadPreHireDoc(
                        card.applicationId,
                        "SECURITY_STUDY",
                      )
                    }
                  />
                  {card.securityStudyStatus ? (
                    <p className="text-[11px] text-muted-foreground">
                      {PRE_HIRE_CHECK_STATUS_LABELS[card.securityStudyStatus]}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <DocAvailability
                    available={Boolean(card.hasMedicalExamDoc)}
                    onDownload={() =>
                      void downloadPreHireDoc(
                        card.applicationId,
                        "MEDICAL_EXAM",
                      )
                    }
                  />
                  {card.medicalExamStatus ? (
                    <p className="text-[11px] text-muted-foreground">
                      {PRE_HIRE_CHECK_STATUS_LABELS[card.medicalExamStatus]}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onDownloadOfferTemplate()}
                  >
                    Descargar plantilla
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingOfferLetter}
                    onClick={() => onUploadOfferLetter(card)}
                  >
                    {card.hasSignedOfferLetter
                      ? "Reemplazar"
                      : "Cargar carta"}
                  </Button>
                  {card.hasSignedOfferLetter ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onDownloadFilledOfferLetter(card)}
                    >
                      Descargar
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin archivo
                    </p>
                  )}
                  <p className="w-full text-[11px] text-muted-foreground">
                    {filledOfferLetterStatusLabel(
                      Boolean(card.hasSignedOfferLetter),
                      card.offerLetterApprovalStatus,
                    )}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenDocs(card)}
                  >
                    Ver docs
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/ats/applications/${card.applicationId}`}>
                      Aplicación
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function DocAvailability({
  available,
  onDownload,
}: {
  available: boolean;
  onDownload: () => void;
}) {
  if (!available) {
    return <span className="text-xs text-muted-foreground">Sin archivo</span>;
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={onDownload}>
      Descargar
    </Button>
  );
}

function DocDownloadRow({
  label,
  available,
  statusLabel,
  onDownload,
  onUpload,
  extraActions,
  uploading = false,
  accept = PREHIRE_UPLOAD_ACCEPT,
  maxBytes = PREHIRE_UPLOAD_MAX_BYTES,
}: {
  label: string;
  available: boolean;
  statusLabel?: string;
  onDownload: () => void;
  onUpload?: (file: File) => void;
  extraActions?: ReactNode;
  uploading?: boolean;
  accept?: string;
  maxBytes?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const maxMb = Math.round(maxBytes / (1024 * 1024));

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {available
            ? statusLabel
              ? `Disponible · ${statusLabel}`
              : "Disponible"
            : statusLabel
              ? `Sin archivo · ${statusLabel}`
              : "Sin archivo"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!available}
          onClick={onDownload}
        >
          Descargar
        </Button>
        {extraActions}
        {onUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > maxBytes) {
                  notifyError(
                    new Error(
                      `El documento supera el tamaño máximo (${maxMb} MB).`,
                    ),
                    `El documento supera el tamaño máximo (${maxMb} MB).`,
                  );
                  return;
                }
                onUpload(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading
                ? "Subiendo…"
                : available
                  ? "Reemplazar"
                  : "Subir"}
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function KanbanColumnsPreview() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((column) => (
        <section
          key={column.id}
          aria-label={column.label}
          className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold">{column.label}</h3>
            <Badge variant="secondary">0</Badge>
          </header>
          <div className="p-2">
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              {column.dropHint}
            </p>
          </div>
        </section>
      ))}
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
  onDownloadOfferTemplate,
  onUploadOfferLetter,
  uploadingOfferLetter,
  onDownloadContractTemplate,
  onUploadContract,
  uploadingContract,
  onCreateCollaborator,
  creatingCollaborator,
}: {
  columnId: KanbanColumnId;
  label: string;
  dropHint: string;
  cards: PipelineCard[];
  activeFromStage: ApplicationStage | null;
  onMoveRequest: (card: PipelineCard, columnId: KanbanColumnId) => void;
  onDiscard: (card: PipelineCard) => void;
  onOpenResume: (card: PipelineCard) => void;
  onDownloadOfferTemplate: () => void;
  onUploadOfferLetter: (card: PipelineCard) => void;
  uploadingOfferLetter: boolean;
  onDownloadContractTemplate: () => void;
  onUploadContract: (card: PipelineCard) => void;
  uploadingContract: boolean;
  onCreateCollaborator: (card: PipelineCard) => void;
  creatingCollaborator: boolean;
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
            onDownloadOfferTemplate={onDownloadOfferTemplate}
            onUploadOfferLetter={onUploadOfferLetter}
            uploadingOfferLetter={uploadingOfferLetter}
            onDownloadContractTemplate={onDownloadContractTemplate}
            onUploadContract={onUploadContract}
            uploadingContract={uploadingContract}
            onCreateCollaborator={onCreateCollaborator}
            creatingCollaborator={creatingCollaborator}
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
  onDownloadOfferTemplate,
  onUploadOfferLetter,
  uploadingOfferLetter,
  onDownloadContractTemplate,
  onUploadContract,
  uploadingContract,
  onCreateCollaborator,
  creatingCollaborator,
}: {
  card: PipelineCard;
  onMoveRequest: (card: PipelineCard, columnId: KanbanColumnId) => void;
  onDiscard: (card: PipelineCard) => void;
  onOpenResume: (card: PipelineCard) => void;
  onDownloadOfferTemplate: () => void;
  onUploadOfferLetter: (card: PipelineCard) => void;
  uploadingOfferLetter: boolean;
  onDownloadContractTemplate: () => void;
  onUploadContract: (card: PipelineCard) => void;
  uploadingContract: boolean;
  onCreateCollaborator: (card: PipelineCard) => void;
  creatingCollaborator: boolean;
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
            aria-label="Ver documentos"
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
                Documentos (HV / prehire / carta)
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
      {card.stage === "OFFER" ? (
        <div
          className="mt-2 flex flex-wrap gap-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => void onDownloadOfferTemplate()}
          >
            Descargar plantilla
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={uploadingOfferLetter}
            onClick={() => onUploadOfferLetter(card)}
          >
            {uploadingOfferLetter
              ? "Subiendo…"
              : card.hasSignedOfferLetter
                ? "Reemplazar carta"
                : "Cargar carta"}
          </Button>
          <p
            className={cn(
              "w-full text-[11px]",
              card.hasSignedOfferLetter &&
                card.offerLetterApprovalStatus === "APPROVED"
                ? "text-emerald-600"
                : card.offerLetterApprovalStatus === "REJECTED"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {filledOfferLetterStatusLabel(
              Boolean(card.hasSignedOfferLetter),
              card.offerLetterApprovalStatus,
            )}
          </p>
        </div>
      ) : null}
      {card.stage === "TO_HIRE" ? (
        <div
          className="mt-2 flex flex-wrap gap-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {card.hasCompanyContractTemplate ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => void onDownloadContractTemplate()}
              >
                Descargar plantilla
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={uploadingContract}
                onClick={() => onUploadContract(card)}
              >
                {uploadingContract
                  ? "Subiendo…"
                  : card.hasSignedContract
                    ? "Reemplazar contrato"
                    : "Cargar contrato"}
              </Button>
              <p
                className={cn(
                  "w-full text-[11px]",
                  card.hasSignedContract &&
                    card.contractApprovalStatus === "APPROVED"
                    ? "text-emerald-600"
                    : card.contractApprovalStatus === "REJECTED"
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {filledContractStatusLabel(
                  Boolean(card.hasSignedContract),
                  card.contractApprovalStatus,
                )}
              </p>
            </>
          ) : (
            <p className="w-full text-[11px] text-muted-foreground">
              Sin plantilla de contrato. Puedes crear el colaborador.
            </p>
          )}
          {isReadyToCreateCollaborator(card) ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={creatingCollaborator}
              onClick={() => onCreateCollaborator(card)}
            >
              {creatingCollaborator ? "Creando…" : "Crear colaborador"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function PipelineCardHeader({ card }: { card: PipelineCard }) {
  const fitLevel = card.fitLevel ?? "gray";
  const showEvaluators =
    card.stage === "INTERVIEW" && (card.evaluatorStatuses?.length ?? 0) > 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2.5 shrink-0 rounded-full", FIT_DOT_CLASS[fitLevel])}
          title={card.fitSummary ?? FIT_LEVEL_LABELS[fitLevel]}
          aria-label={card.fitSummary ?? FIT_LEVEL_LABELS[fitLevel]}
        />
        <p className="truncate font-medium">{card.candidateName}</p>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {card.fitSummary ?? FIT_LEVEL_LABELS[fitLevel]}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {card.candidateEmail}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDate(card.lastStageChangedAt)}
      </p>
      {showEvaluators ? (
        <ul className="mt-2 space-y-1">
          {card.evaluatorStatuses!.map((evaluator) => (
            <li
              key={`${evaluator.employeeId ?? evaluator.name}`}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="truncate text-muted-foreground">
                {evaluator.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-medium",
                  evaluator.status === "approved" &&
                    "bg-emerald-100 text-emerald-800",
                  evaluator.status === "in_progress" &&
                    "bg-amber-100 text-amber-800",
                  evaluator.status === "pending" &&
                    "bg-muted text-muted-foreground",
                )}
              >
                {evaluator.status === "approved"
                  ? "Aprobado"
                  : evaluator.status === "in_progress"
                    ? "En curso"
                    : "Pendiente"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

async function downloadPreHireDoc(
  applicationId: string,
  kind: PreHireDocumentKind,
) {
  try {
    const { blob, filename } = await hiringApi.downloadPreHireDocument(
      applicationId,
      kind,
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      filename ||
      (kind === "SECURITY_STUDY" ? "estudio-seguridad" : "examenes-medicos");
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    notifyError(
      error,
      kind === "SECURITY_STUDY"
        ? "No se pudo descargar el estudio de seguridad."
        : "No se pudo descargar los exámenes médicos.",
    );
  }
}

function pipelinePdiHireMessage(
  pdi: HirePdiSyncResult | undefined,
  pdiEnabled: boolean,
): string {
  if (!pdiEnabled) return "Contratación registrada";
  if (!pdi || pdi.status === "SKIPPED_NO_FEATURE") {
    return "Contratación registrada";
  }
  if (pdi.status === "SYNCED") {
    return `Contratación registrada. PDI cargado en Performance${
      pdi.cycleName ? ` (${pdi.cycleName})` : ""
    }.`;
  }
  if (pdi.status === "SKIPPED_NO_CYCLE") {
    return "Contratación registrada. PDI listo para descargar; no hay ciclo Performance activo.";
  }
  return "Contratación registrada. Sin aportes de entrevista para armar el PDI.";
}
