"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import {
  INTERVIEW_FORM_STATUS_LABELS,
  INTERVIEW_QUESTION_TYPE_LABELS,
  INTERVIEW_TYPE_LABELS,
} from "@/lib/ats/labels";
import type {
  AddTemplateQuestionInput,
  CreateInterviewFormTemplateInput,
  InterviewFormStatus,
  InterviewFormTemplate,
  InterviewQuestionType,
  InterviewType,
  UpdateInterviewFormTemplateInput,
} from "@/types/interviews";

type TemplateForm = {
  name: string;
  description: string;
  type: InterviewType;
};

type QuestionForm = {
  text: string;
  type: InterviewQuestionType;
  required: boolean;
  weight: string;
  order: string;
};

const emptyTemplate = (): TemplateForm => ({
  name: "",
  description: "",
  type: "GENERAL",
});

const emptyQuestion = (order: number): QuestionForm => ({
  text: "",
  type: "TEXTAREA",
  required: true,
  weight: "",
  order: String(order),
});

export function InterviewTemplatesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewFormTemplate | null>(null);
  const [form, setForm] = useState(emptyTemplate());
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestion(0));
  const [questionError, setQuestionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: interviewKeys.templates(companyId),
    queryFn: () => interviewsApi.listTemplates(),
  });

  const selected = useMemo(
    () => (listQuery.data ?? []).find((t) => t.id === selectedId) ?? null,
    [listQuery.data, selectedId],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const body: UpdateInterviewFormTemplateInput = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type,
        };
        return interviewsApi.updateTemplate(editing.id, body);
      }
      const body: CreateInterviewFormTemplateInput = {
        name: form.name.trim(),
        type: form.type,
      };
      if (form.description.trim()) body.description = form.description.trim();
      return interviewsApi.createTemplate(body);
    },
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.templates(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyTemplate());
      setSelectedId(template.id);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar la plantilla."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: InterviewFormStatus;
    }) => interviewsApi.updateTemplate(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.templates(companyId),
      });
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: (body: AddTemplateQuestionInput) => {
      if (!selectedId) throw new Error("no template");
      return interviewsApi.addTemplateQuestion(selectedId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.templates(companyId),
      });
      const nextOrder = (selected?.questions?.length ?? 0) + 1;
      setQuestionForm(emptyQuestion(nextOrder));
      setQuestionError(null);
    },
    onError: (error) => {
      setQuestionError(
        getErrorMessage(error, "No se pudo agregar la pregunta."),
      );
    },
  });

  const items = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de entrevista"
        description="Formularios reutilizables. Las preguntas de plantilla solo se pueden agregar (no editar/eliminar vía API)."
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(emptyTemplate());
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Nueva plantilla
          </Button>
        }
      />

      {listQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las plantillas"
          description={getErrorMessage(listQuery.error, "Error.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState title="Aún no hay plantillas de entrevista." />
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Preguntas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((template) => (
                  <TableRow
                    key={template.id}
                    className={
                      selectedId === template.id ? "bg-muted/40" : undefined
                    }
                    onClick={() => {
                      setSelectedId(template.id);
                      setQuestionForm(
                        emptyQuestion(template.questions?.length ?? 0),
                      );
                    }}
                  >
                    <TableCell className="font-medium">
                      <button type="button" className="text-left underline-offset-2 hover:underline">
                        {template.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {INTERVIEW_TYPE_LABELS[template.type]}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {INTERVIEW_FORM_STATUS_LABELS[template.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.questions?.length ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((template) => (
              <button
                key={template.id}
                type="button"
                className="w-full rounded-lg border border-border p-4 text-left"
                onClick={() => setSelectedId(template.id)}
              >
                <p className="font-medium">{template.name}</p>
                <p className="text-sm text-muted-foreground">
                  {INTERVIEW_TYPE_LABELS[template.type]} ·{" "}
                  {template.questions?.length ?? 0} preguntas
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-lg border border-border p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Selecciona una plantilla para ver preguntas.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.description || "Sin descripción"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(selected);
                        setForm({
                          name: selected.name,
                          description: selected.description ?? "",
                          type: selected.type,
                        });
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          id: selected.id,
                          status:
                            selected.status === "ACTIVE"
                              ? "INACTIVE"
                              : "ACTIVE",
                        })
                      }
                    >
                      {selected.status === "ACTIVE"
                        ? "Desactivar"
                        : "Activar"}
                    </Button>
                  </div>
                </div>

                <ul className="space-y-2">
                  {[...(selected.questions ?? [])]
                    .sort((a, b) => a.order - b.order)
                    .map((q) => (
                      <li
                        key={q.id}
                        className="rounded-md border border-border p-3 text-sm"
                      >
                        <p className="font-medium">
                          #{q.order} {q.text}
                          {q.required ? " *" : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {INTERVIEW_QUESTION_TYPE_LABELS[q.type]}
                          {q.weight != null ? ` · peso ${q.weight}` : ""}
                        </p>
                      </li>
                    ))}
                </ul>

                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium">Agregar pregunta</p>
                  <p className="text-xs text-muted-foreground">
                    La API no permite editar ni eliminar preguntas existentes.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="tq-text">Texto *</Label>
                    <Textarea
                      id="tq-text"
                      value={questionForm.text}
                      onChange={(e) =>
                        setQuestionForm((f) => ({
                          ...f,
                          text: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <FormSelect
                    id="tq-type"
                    label="Tipo"
                    value={questionForm.type}
                    onChange={(type) =>
                      setQuestionForm((f) => ({
                        ...f,
                        type: type as InterviewQuestionType,
                      }))
                    }
                    options={Object.entries(INTERVIEW_QUESTION_TYPE_LABELS).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tq-order">Orden *</Label>
                      <Input
                        id="tq-order"
                        type="number"
                        min={0}
                        value={questionForm.order}
                        onChange={(e) =>
                          setQuestionForm((f) => ({
                            ...f,
                            order: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tq-weight">Peso</Label>
                      <Input
                        id="tq-weight"
                        type="number"
                        min={0}
                        value={questionForm.weight}
                        onChange={(e) =>
                          setQuestionForm((f) => ({
                            ...f,
                            weight: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={questionForm.required}
                      onCheckedChange={(checked) =>
                        setQuestionForm((f) => ({
                          ...f,
                          required: checked === true,
                        }))
                      }
                    />
                    Requerida
                  </label>
                  {questionError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {questionError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={
                      !questionForm.text.trim() || addQuestionMutation.isPending
                    }
                    onClick={() => {
                      const body: AddTemplateQuestionInput = {
                        text: questionForm.text.trim(),
                        type: questionForm.type,
                        required: questionForm.required,
                        order: Number(questionForm.order),
                      };
                      if (questionForm.weight !== "") {
                        body.weight = Number(questionForm.weight);
                      }
                      addQuestionMutation.mutate(body);
                    }}
                  >
                    Agregar pregunta
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Link href="/ats/interviews" className="underline">
          Volver a entrevistas
        </Link>
      </p>

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar plantilla" : "Nueva plantilla"}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nombre *</Label>
            <Input
              id="tpl-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <FormSelect
            id="tpl-type"
            label="Tipo"
            required
            value={form.type}
            onChange={(type) =>
              setForm((f) => ({ ...f, type: type as InterviewType }))
            }
            options={Object.entries(INTERVIEW_TYPE_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Descripción</Label>
            <Textarea
              id="tpl-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
