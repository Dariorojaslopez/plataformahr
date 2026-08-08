"use client";

import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEW_TYPE_LABELS } from "@/lib/ats/labels";
import type { CreateInterviewInput, InterviewType } from "@/types/interviews";

export type InterviewFormValues = {
  type: InterviewType;
  scheduledAt: string;
  location: string;
  meetingUrl: string;
  notes: string;
  localRecordingName: string;
  interviewerEmployeeIds: string[];
  templateId: string;
};

export const emptyInterviewForm = (): InterviewFormValues => ({
  type: "GENERAL",
  scheduledAt: "",
  location: "",
  meetingUrl: "",
  notes: "",
  localRecordingName: "",
  interviewerEmployeeIds: [],
  templateId: "",
});

export function toCreateInterviewPayload(
  values: InterviewFormValues,
): CreateInterviewInput {
  const payload: CreateInterviewInput = {
    type: values.type,
    interviewerEmployeeIds: values.interviewerEmployeeIds,
  };
  if (values.scheduledAt) payload.scheduledAt = new Date(values.scheduledAt).toISOString();
  if (values.location.trim()) payload.location = values.location.trim();
  if (values.meetingUrl.trim()) payload.meetingUrl = values.meetingUrl.trim();
  if (values.notes.trim()) payload.notes = values.notes.trim();
  if (values.localRecordingName.trim()) {
    payload.localRecordingName = values.localRecordingName.trim();
  }
  if (values.templateId) payload.templateId = values.templateId;
  return payload;
}

type Option = { value: string; label: string };

type InterviewFormProps = {
  values: InterviewFormValues;
  onChange: (values: InterviewFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  employees: Option[];
  templates: Option[];
  submitting?: boolean;
  error?: string | null;
};

export function InterviewForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  employees,
  templates,
  submitting,
  error,
}: InterviewFormProps) {
  function toggleInterviewer(id: string, checked: boolean) {
    const set = new Set(values.interviewerEmployeeIds);
    if (checked) set.add(id);
    else set.delete(id);
    onChange({ ...values, interviewerEmployeeIds: [...set] });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <FormSelect
        id="iv-type"
        label="Tipo"
        required
        value={values.type}
        onChange={(type) =>
          onChange({ ...values, type: type as InterviewType })
        }
        options={Object.entries(INTERVIEW_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />

      <div className="space-y-2">
        <Label htmlFor="iv-scheduled">Fecha programada</Label>
        <Input
          id="iv-scheduled"
          type="datetime-local"
          value={values.scheduledAt}
          onChange={(e) =>
            onChange({ ...values, scheduledAt: e.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="iv-location">Ubicación</Label>
        <Input
          id="iv-location"
          value={values.location}
          onChange={(e) => onChange({ ...values, location: e.target.value })}
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="iv-url">URL de reunión</Label>
        <Input
          id="iv-url"
          value={values.meetingUrl}
          onChange={(e) => onChange({ ...values, meetingUrl: e.target.value })}
          maxLength={500}
        />
      </div>

      <FormSelect
        id="iv-template"
        label="Plantilla"
        value={values.templateId}
        onChange={(templateId) => onChange({ ...values, templateId })}
        options={templates}
        allowEmpty
        emptyLabel="Sin plantilla"
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Entrevistadores *</legend>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay colaboradores activos.
            </p>
          ) : (
            employees.map((emp) => (
              <label
                key={emp.value}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={values.interviewerEmployeeIds.includes(emp.value)}
                  onCheckedChange={(checked) =>
                    toggleInterviewer(emp.value, checked === true)
                  }
                />
                {emp.label}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="iv-notes">Notas</Label>
        <Textarea
          id="iv-notes"
          value={values.notes}
          onChange={(e) => onChange({ ...values, notes: e.target.value })}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="iv-local">Nombre de grabación local (metadata)</Label>
        <Input
          id="iv-local"
          value={values.localRecordingName}
          onChange={(e) =>
            onChange({ ...values, localRecordingName: e.target.value })
          }
          maxLength={255}
          placeholder="Ej. entrevista-2026-03-01.m4a"
        />
        <p className="text-xs text-muted-foreground">
          Solo nombre visible. No es un enlace ni un archivo en el servidor.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={
            submitting || values.interviewerEmployeeIds.length === 0
          }
        >
          {submitting ? "Guardando…" : "Programar entrevista"}
        </Button>
      </div>
    </form>
  );
}
