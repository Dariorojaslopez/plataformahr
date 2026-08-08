"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import {
  AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE,
  getDefaultSpeechProvider,
} from "@/lib/ats/speech-transcription";
import {
  TRANSCRIPT_KIND_LABELS,
  transcriptKindVariant,
} from "@/lib/ats/labels";
import type {
  CreateTranscriptSegmentInput,
  InterviewTranscriptSegment,
  TranscriptSegmentKind,
  UpdateTranscriptSegmentInput,
} from "@/types/interviews";

type Props = {
  companyId: string;
  interviewId: string;
  canEdit: boolean;
};

export function InterviewTranscriptPanel({
  companyId,
  interviewId,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const speech = getDefaultSpeechProvider();

  const [draft, setDraft] = useState<CreateTranscriptSegmentInput>({
    text: "",
    kind: "UNCLASSIFIED",
    speakerLabel: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InterviewTranscriptSegment | null>(
    null,
  );
  const [editForm, setEditForm] = useState<UpdateTranscriptSegmentInput>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const transcriptQuery = useQuery({
    queryKey: interviewKeys.transcript(companyId, interviewId),
    queryFn: () => interviewsApi.getTranscript(interviewId),
  });

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: interviewKeys.transcript(companyId, interviewId),
    });
    await queryClient.invalidateQueries({
      queryKey: interviewKeys.detail(companyId, interviewId),
    });
  }

  const addMutation = useMutation({
    mutationFn: () => {
      const body: CreateTranscriptSegmentInput = {
        text: draft.text.trim(),
        kind: draft.kind,
      };
      if (draft.speakerLabel?.trim()) {
        body.speakerLabel = draft.speakerLabel.trim();
      }
      // sequence intentionally omitted — backend generates it
      return interviewsApi.addTranscriptSegment(interviewId, body);
    },
    onSuccess: async () => {
      await invalidate();
      setDraft({ text: "", kind: "UNCLASSIFIED", speakerLabel: "" });
      setAddError(null);
    },
    onError: (error) => {
      setAddError(getErrorMessage(error, "No se pudo agregar el segmento."));
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("missing segment");
      return interviewsApi.updateTranscriptSegment(
        interviewId,
        editing.id,
        editForm,
      );
    },
    onSuccess: async () => {
      await invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (segmentId: string) =>
      interviewsApi.deleteTranscriptSegment(interviewId, segmentId),
    onSuccess: async () => {
      await invalidate();
      setDeleteId(null);
    },
  });

  const segments = [...(transcriptQuery.data ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Transcripción</h2>
        {!speech.isSupported() || speech.id === "manual" ? (
          <p className="text-sm text-muted-foreground">
            {AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE}. Usa entrada manual.
          </p>
        ) : null}
      </div>

      {transcriptQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {transcriptQuery.isError ? (
        <ErrorState
          title="No se pudo cargar la transcripción"
          description={getErrorMessage(transcriptQuery.error, "Error.")}
          onRetry={() => void transcriptQuery.refetch()}
        />
      ) : null}

      {transcriptQuery.isSuccess && segments.length === 0 ? (
        <EmptyState title="Aún no hay segmentos de transcripción." />
      ) : null}

      <ul className="space-y-2">
        {segments.map((segment) => (
          <li
            key={segment.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={transcriptKindVariant(segment.kind)}>
                {TRANSCRIPT_KIND_LABELS[segment.kind]}
              </Badge>
              {segment.speakerLabel ? (
                <span className="text-xs text-muted-foreground">
                  {segment.speakerLabel}
                </span>
              ) : null}
              {canEdit ? (
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Editar segmento"
                    onClick={() => {
                      setEditing(segment);
                      setEditForm({
                        text: segment.text,
                        kind: segment.kind,
                        speakerLabel: segment.speakerLabel,
                      });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar segmento"
                    onClick={() => setDeleteId(segment.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm">{segment.text}</p>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-medium">Agregar segmento</p>
          <FormSelect
            id="seg-kind"
            label="Tipo"
            value={draft.kind ?? "UNCLASSIFIED"}
            onChange={(kind) =>
              setDraft((d) => ({
                ...d,
                kind: kind as TranscriptSegmentKind,
              }))
            }
            options={Object.entries(TRANSCRIPT_KIND_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="seg-speaker">Speaker (opcional)</Label>
            <Input
              id="seg-speaker"
              value={draft.speakerLabel ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, speakerLabel: e.target.value }))
              }
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seg-text">Texto *</Label>
            <Textarea
              id="seg-text"
              value={draft.text}
              onChange={(e) =>
                setDraft((d) => ({ ...d, text: e.target.value }))
              }
              rows={3}
              required
            />
          </div>
          {addError ? (
            <p className="text-sm text-destructive" role="alert">
              {addError}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!draft.text.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            Agregar
          </Button>
        </div>
      ) : null}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar segmento</DialogTitle>
          </DialogHeader>
          <FormSelect
            id="edit-kind"
            label="Tipo"
            value={(editForm.kind as string) ?? "UNCLASSIFIED"}
            onChange={(kind) =>
              setEditForm((f) => ({
                ...f,
                kind: kind as TranscriptSegmentKind,
              }))
            }
            options={Object.entries(TRANSCRIPT_KIND_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="edit-speaker">Speaker</Label>
            <Input
              id="edit-speaker"
              value={editForm.speakerLabel ?? ""}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  speakerLabel: e.target.value || null,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-text">Texto</Label>
            <Textarea
              id="edit-text"
              value={editForm.text ?? ""}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, text: e.target.value }))
              }
              rows={4}
            />
          </div>
          {editMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(editMutation.error, "No se pudo guardar.")}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar segmento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer desde la UI.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
