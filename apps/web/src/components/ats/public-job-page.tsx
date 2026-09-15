"use client";

import { CANDIDATE_DOCUMENT_TYPES } from "@talento/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { publicApiAssetUrl } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { publicJobsApi } from "@/lib/api/ats";
import { brandCssVars, companyInitials } from "@/lib/company/brand-tokens";
import { PublicJobContent } from "@/components/ats/public-job-content";
import { EDUCATION_LEVEL_LABELS } from "@/lib/ats/labels";
import {
  formatBooleanScreeningAnswer,
  isBooleanScreeningType,
  optionLetter,
  toggleMultipleChoiceSelection,
} from "@/lib/ats/screening";
import { cn } from "@/lib/utils";
import type {
  EducationLevel,
  ParsedPublicCv,
  PublicEducationInput,
  PublicJob,
  PublicJobApplicationInput,
  PublicScreeningQuestion,
  PublicWorkExperienceInput,
} from "@/types/ats";

const CV_ACCEPT =
  ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const CV_MAX_BYTES = 15 * 1024 * 1024;

function isAllowedCvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt")
  );
}

const emptyExperience = (): PublicWorkExperienceInput => ({
  companyName: "",
  country: "",
  positionTitle: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  functions: "",
  achievements: "",
});

const emptyEducation = (): PublicEducationInput => ({
  institution: "",
  program: "",
  educationLevel: "",
  startDate: "",
  endDate: "",
  isStudying: false,
});

const emptyForm = (): PublicJobApplicationInput => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  country: "",
  state: "",
  city: "",
  professionalProfile: "",
  linkedinUrl: "",
  workExperience: [emptyExperience()],
  education: [emptyEducation()],
  screeningAnswers: [],
});

const EDUCATION_OPTIONS = (
  Object.entries(EDUCATION_LEVEL_LABELS) as Array<[EducationLevel, string]>
).map(([value, label]) => ({ value, label }));

const MAX_PROFILE_SEGMENTS = 10;

function isExperienceFilled(item: PublicWorkExperienceInput): boolean {
  return Boolean(
    item.companyName.trim() ||
      item.positionTitle.trim() ||
      item.startDate.trim(),
  );
}

function isEducationFilled(item: PublicEducationInput): boolean {
  return Boolean(
    item.institution.trim() ||
      item.program.trim() ||
      item.educationLevel ||
      item.startDate.trim(),
  );
}

function compactForm(form: PublicJobApplicationInput): PublicJobApplicationInput {
  const workExperience = form.workExperience.filter(isExperienceFilled);
  const education = form.education.filter(isEducationFilled);
  return {
    ...form,
    workExperience:
      workExperience.length > 0 ? workExperience : [emptyExperience()],
    education: education.length > 0 ? education : [emptyEducation()],
  };
}

function upsertScreeningAnswer(
  answers: PublicJobApplicationInput["screeningAnswers"],
  questionId: string,
  patch: { answer?: boolean | null; selectedOptionIds?: string[] },
): PublicJobApplicationInput["screeningAnswers"] {
  const existing = answers.find((item) => item.questionId === questionId);
  if (!existing) {
    return [...answers, { questionId, ...patch }];
  }
  return answers.map((item) =>
    item.questionId === questionId ? { ...item, ...patch } : item,
  );
}

function isScreeningAnswered(
  question: PublicScreeningQuestion,
  answers: PublicJobApplicationInput["screeningAnswers"],
) {
  const current = answers.find((item) => item.questionId === question.id);
  const type = question.type ?? "YES_NO";
  if (isBooleanScreeningType(type)) return typeof current?.answer === "boolean";
  return (current?.selectedOptionIds?.length ?? 0) > 0;
}

export function PublicJobPage({
  publicId,
  job: jobOverride,
  preview = false,
  previewLogoSrc = null,
}: {
  publicId?: string;
  job?: PublicJob;
  preview?: boolean;
  /** Logo autenticado para vista previa cuando aún no hay publicId. */
  previewLogoSrc?: string | null;
}) {
  const [form, setForm] = useState(emptyForm);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvHint, setCvHint] = useState<string | null>(null);
  const [cvDragOver, setCvDragOver] = useState(false);
  const [linkedinPaste, setLinkedinPaste] = useState("");
  const [linkedinHint, setLinkedinHint] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const jobQuery = useQuery({
    queryKey: ["public-job", publicId],
    queryFn: () => publicJobsApi.get(publicId!),
    enabled: Boolean(publicId) && !jobOverride,
    retry: false,
  });
  const job = jobOverride ?? jobQuery.data;
  const applyMutation = useMutation({
    mutationFn: () => {
      const questions = job?.screeningQuestions ?? [];
      if (questions.some((question) => !isScreeningAnswered(question, form.screeningAnswers))) {
        throw new Error("Debes responder todas las preguntas de screening.");
      }
      const screeningAnswers = questions.map((question) => {
        const existing = form.screeningAnswers.find(
          (item) => item.questionId === question.id,
        );
        return {
          questionId: question.id,
          answer: existing?.answer ?? null,
          selectedOptionIds: existing?.selectedOptionIds ?? [],
        };
      });
      return publicJobsApi.apply(
        publicId!,
        compactForm({ ...form, screeningAnswers }),
        cvFile ?? undefined,
      );
    },
  });
  const parseCvMutation = useMutation({
    mutationFn: (file: File) => publicJobsApi.parseCv(publicId!, file),
    onSuccess: (parsed, file) => {
      setForm((current) => applyParsedCv(current, parsed));
      setCvHint(
        hasParsedContact(parsed)
          ? "Revisa y corrige los datos extraídos de tu hoja de vida."
          : "No pudimos extraer datos. Complétalos manualmente.",
      );
      setCvFile(file);
    },
    onError: (error, file) => {
      setCvFile(file);
      setCvHint(
        getErrorMessage(
          error,
          "No se pudo leer la hoja de vida. Completa el formulario.",
        ),
      );
    },
  });
  const parseLinkedInMutation = useMutation({
    mutationFn: () =>
      publicJobsApi.parseLinkedIn(publicId!, {
        linkedinUrl: form.linkedinUrl || undefined,
        profileText: linkedinPaste || undefined,
      }),
    onSuccess: (parsed) => {
      setForm((current) => applyParsedCv(current, parsed));
      setLinkedinHint(
        hasParsedContact(parsed)
          ? "Revisa y corrige los datos tomados de LinkedIn."
          : "Guardamos el enlace. Completa el resto del formulario.",
      );
    },
    onError: (error) => {
      setLinkedinHint(
        getErrorMessage(
          error,
          "No se pudo leer el perfil de LinkedIn. Completa el formulario.",
        ),
      );
    },
  });

  const loading = !jobOverride && jobQuery.isLoading;
  const failed = !jobOverride && (jobQuery.isError || !jobQuery.data);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl space-y-5 px-6 py-12">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm font-medium text-primary">Talentgrowthos</p>
          <h1 className="text-2xl font-semibold">Vacante no disponible</h1>
          <p className="text-sm text-muted-foreground">
            La vacante no existe, fue despublicada o ya no recibe postulaciones.
          </p>
        </div>
      </main>
    );
  }

  if (!job) {
    return null;
  }
  const logoPublicId = publicId ?? job.publicId;
  const logoSrc =
    preview && previewLogoSrc
      ? previewLogoSrc
      : job.hasLogo && logoPublicId
        ? publicApiAssetUrl(
            `/public/jobs/${encodeURIComponent(logoPublicId)}/logo`,
          )
        : null;
  const update = <K extends keyof PublicJobApplicationInput>(
    field: K,
    value: PublicJobApplicationInput[K],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const onCvFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedCvFile(file)) {
      setCvHint("La hoja de vida debe ser PDF, DOC, DOCX o TXT.");
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      setCvHint("La hoja de vida supera el tamaño máximo (15 MB).");
      return;
    }
    if (preview || !publicId) {
      setCvFile(file);
      setCvHint(
        preview
          ? "Vista previa: el archivo no se analiza aquí."
          : "Selecciona un archivo para adjuntarlo.",
      );
      return;
    }
    parseCvMutation.mutate(file);
  };

  return (
    <main
      className="min-h-screen bg-muted/30"
      style={brandCssVars(job.brandPrimaryColor, {
        dark: resolvedTheme === "dark",
      })}
    >
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-6">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`Logo de ${job.companyName}`}
              className="h-[4.5rem] w-[7.5rem] shrink-0 rounded-md object-contain object-left sm:h-20 sm:w-36"
            />
          ) : (
            <div className="flex h-[4.5rem] w-[7.5rem] shrink-0 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground sm:h-20 sm:w-36">
              {companyInitials(job.companyName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold sm:text-lg">{job.companyName}</p>
            <p className="text-sm text-muted-foreground">
              Oportunidades laborales
            </p>
          </div>
        </div>
      </header>

      {preview ? (
        <p className="border-b bg-muted px-6 py-2 text-center text-sm text-muted-foreground">
          Vista previa de la página pública
          {job.publishedAt ? "" : " — aún no está publicada"}
        </p>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <PublicJobContent job={job} />

        {!preview && applyMutation.isSuccess ? (
          <div
            className="rounded-xl border bg-card p-8 text-center"
            role="status"
          >
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h2 className="mt-3 text-xl font-semibold">Postulación recibida</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Gracias por tu interés. El equipo revisará tu información.
            </p>
          </div>
        ) : (
          <form
            className="space-y-8 rounded-xl border bg-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                preview ||
                !cvFile ||
                applyMutation.isPending ||
                parseCvMutation.isPending
              ) {
                return;
              }
              applyMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Formulario de postulación</h2>
              {preview ? (
                <p className="text-sm text-muted-foreground">
                  Así lo verá el candidato. En vista previa puedes recorrer el
                  formulario, pero no se envía la postulación.
                </p>
              ) : null}
            </div>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Hoja de vida</h3>
              <div className="space-y-2">
                <Label htmlFor="job-cv">Archivo PDF o Word *</Label>
                <div
                  className={cn(
                    "rounded-lg border border-dashed transition-colors",
                    cvDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20",
                    parseCvMutation.isPending && "opacity-70",
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCvDragOver(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCvDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCvDragOver(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCvDragOver(false);
                    onCvFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <label
                    htmlFor="job-cv"
                    className="flex cursor-pointer flex-col items-center justify-center px-6 py-8 text-center"
                  >
                    <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {cvFile
                        ? cvFile.name
                        : "Arrastra tu hoja de vida aquí"}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {parseCvMutation.isPending
                        ? "Leyendo archivo…"
                        : "o haz clic para seleccionar · PDF, DOC, DOCX o TXT (máx. 15 MB)"}
                    </span>
                    <input
                      id="job-cv"
                      type="file"
                      required={!preview}
                      accept={CV_ACCEPT}
                      className="sr-only"
                      disabled={parseCvMutation.isPending}
                      onChange={(event) => {
                        onCvFile(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Completaremos contacto, perfil, experiencia y formación si
                  podemos leerlos.
                </p>
                {cvHint ? (
                  <p className="text-xs text-muted-foreground">{cvHint}</p>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">LinkedIn (opcional)</h3>
              <TextField
                id="job-linkedin-url"
                label="URL de tu perfil"
                value={form.linkedinUrl}
                onChange={(value) => update("linkedinUrl", value)}
                required={false}
              />
              <div className="space-y-2">
                <Label htmlFor="job-linkedin-paste">
                  Pegar texto del perfil
                </Label>
                <Textarea
                  id="job-linkedin-paste"
                  rows={5}
                  value={linkedinPaste}
                  onChange={(event) => setLinkedinPaste(event.target.value)}
                  placeholder="Copia About / Experience / Education desde LinkedIn y pégalo aquí para autocompletar."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      preview ||
                      parseLinkedInMutation.isPending ||
                      (!form.linkedinUrl.trim() && !linkedinPaste.trim()) ||
                      !publicId
                    }
                    onClick={() => parseLinkedInMutation.mutate()}
                  >
                    {parseLinkedInMutation.isPending
                      ? "Leyendo…"
                      : "Completar desde LinkedIn"}
                  </Button>
                </div>
                {linkedinHint ? (
                  <p className="text-xs text-muted-foreground">{linkedinHint}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No conectamos con OAuth de LinkedIn: guarda el enlace y, si
                    quieres, pega el texto del perfil para rellenar el
                    formulario.
                  </p>
                )}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="job-first-name"
                label="Nombres"
                value={form.firstName}
                onChange={(value) => update("firstName", value)}
                required={!preview}
              />
              <TextField
                id="job-last-name"
                label="Apellidos"
                value={form.lastName}
                onChange={(value) => update("lastName", value)}
                required={!preview}
              />
              <TextField
                id="job-email"
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(value) => update("email", value)}
                required={!preview}
              />
              <TextField
                id="job-phone"
                label="Teléfono de contacto"
                type="tel"
                value={form.phone}
                onChange={(value) => update("phone", value)}
                required={!preview}
              />
              <TextField
                id="job-birth-date"
                label="Fecha de nacimiento"
                type="date"
                value={form.birthDate}
                onChange={(value) => update("birthDate", value)}
                required={!preview}
              />
              <FormSelect
                id="job-document-type"
                label="Tipo de documento"
                required={!preview}
                value={form.documentType}
                onChange={(value) => update("documentType", value)}
                options={CANDIDATE_DOCUMENT_TYPES.map(({ code, label }) => ({
                  value: code,
                  label,
                }))}
              />
              <TextField
                id="job-document-number"
                label="Número de documento"
                value={form.documentNumber}
                onChange={(value) => update("documentNumber", value)}
                required={!preview}
              />
              <TextField
                id="job-country"
                label="País"
                value={form.country}
                onChange={(value) => update("country", value)}
                required={!preview}
              />
              <TextField
                id="job-state"
                label="Departamento / estado"
                value={form.state}
                onChange={(value) => update("state", value)}
                required={!preview}
              />
              <TextField
                id="job-city"
                label="Ciudad"
                value={form.city}
                onChange={(value) => update("city", value)}
                required={!preview}
              />
            </section>

            <section className="space-y-2">
              <Label htmlFor="job-profile">Perfil profesional *</Label>
              <Textarea
                id="job-profile"
                required={!preview}
                rows={4}
                maxLength={4000}
                value={form.professionalProfile}
                onChange={(event) =>
                  update("professionalProfile", event.target.value)
                }
              />
            </section>

            <ExperienceEditor
              items={form.workExperience}
              onChange={(workExperience) => update("workExperience", workExperience)}
            />

            <EducationEditor
              items={form.education}
              onChange={(education) => update("education", education)}
            />

            {(job.screeningQuestions?.length ?? 0) > 0 ? (
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Preguntas de screening</h3>
                  {job.screeningMinCorrect != null ? (
                    <p className="text-xs text-muted-foreground">
                      Debes responder correctamente al menos{" "}
                      {job.screeningMinCorrect} pregunta
                      {job.screeningMinCorrect === 1 ? "" : "s"}.
                    </p>
                  ) : null}
                </div>
                {job.screeningQuestions!.map((question) => {
                  const current = form.screeningAnswers.find(
                    (item) => item.questionId === question.id,
                  );
                  const type = question.type ?? "YES_NO";
                  return (
                    <fieldset key={question.id} className="space-y-2 rounded-md border p-3">
                      <legend className="px-1 text-sm font-medium">
                        {question.prompt}
                      </legend>
                      {isBooleanScreeningType(type) ? (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`screen-${question.id}`}
                              checked={current?.answer === true}
                              required={!preview}
                              onChange={() =>
                                update(
                                  "screeningAnswers",
                                  upsertScreeningAnswer(
                                    form.screeningAnswers,
                                    question.id,
                                    { answer: true },
                                  ),
                                )
                              }
                            />
                            {formatBooleanScreeningAnswer(type, true)}
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`screen-${question.id}`}
                              checked={current?.answer === false}
                              required={!preview}
                              onChange={() =>
                                update(
                                  "screeningAnswers",
                                  upsertScreeningAnswer(
                                    form.screeningAnswers,
                                    question.id,
                                    { answer: false },
                                  ),
                                )
                              }
                            />
                            {formatBooleanScreeningAnswer(type, false)}
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(question.options ?? []).map((option, optionIndex) => {
                            const selected = current?.selectedOptionIds ?? [];
                            const checked = selected.includes(option.id);
                            const multiple = type === "MULTIPLE_CHOICE";
                            return (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type={multiple ? "checkbox" : "radio"}
                                  name={
                                    multiple
                                      ? undefined
                                      : `screen-${question.id}`
                                  }
                                  checked={checked}
                                  required={
                                    preview || multiple ? undefined : true
                                  }
                                  onChange={() =>
                                    update(
                                      "screeningAnswers",
                                      upsertScreeningAnswer(
                                        form.screeningAnswers,
                                        question.id,
                                        {
                                          selectedOptionIds: multiple
                                            ? toggleMultipleChoiceSelection(
                                                selected,
                                                option.id,
                                                question.options ?? [],
                                              )
                                            : [option.id],
                                        },
                                      ),
                                    )
                                  }
                                />
                                <span>
                                  {optionLetter(optionIndex)}. {option.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </section>
            ) : null}

            {applyMutation.isError && !preview ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(
                  applyMutation.error,
                  "No fue posible registrar la postulación.",
                )}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                preview ||
                applyMutation.isPending ||
                parseCvMutation.isPending ||
                !cvFile
              }
            >
              {preview
                ? "Enviar postulación (solo vista previa)"
                : applyMutation.isPending
                  ? "Enviando…"
                  : "Enviar postulación"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: PublicWorkExperienceInput[];
  onChange: (items: PublicWorkExperienceInput[]) => void;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  function toggle(index: number) {
    setOpen((current) => ({ ...current, [index]: !current[index] }));
  }

  function addItem() {
    if (items.length >= MAX_PROFILE_SEGMENTS) return;
    const nextIndex = items.length;
    onChange([...items, emptyExperience()]);
    setOpen((current) => ({ ...current, [nextIndex]: true }));
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Experiencia laboral</h3>
          <p className="text-xs text-muted-foreground">
            Hasta {MAX_PROFILE_SEGMENTS} experiencias. Solo la primera es
            obligatoria.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= MAX_PROFILE_SEGMENTS}
          onClick={addItem}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      {items.map((item, index) => {
        const required = index === 0;
        const expanded = open[index] ?? index === 0;
        const title =
          item.companyName.trim() ||
          item.positionTitle.trim() ||
          `Experiencia ${index + 1}`;
        return (
          <div key={index} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              onClick={() => toggle(index)}
              aria-expanded={expanded}
            >
              <span className="truncate text-sm font-medium">
                {title}
                {required ? " *" : ""}
              </span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {expanded ? (
              <div className="space-y-3 border-t p-3">
                <div className="flex justify-end">
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange(items.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id={`exp-company-${index}`}
                    label="Empresa"
                    value={item.companyName}
                    onChange={(companyName) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, companyName } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <TextField
                    id={`exp-country-${index}`}
                    label="País"
                    value={item.country}
                    onChange={(country) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, country } : row,
                        ),
                      )
                    }
                    required={false}
                  />
                  <TextField
                    id={`exp-title-${index}`}
                    label="Cargo"
                    value={item.positionTitle}
                    onChange={(positionTitle) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, positionTitle } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <TextField
                    id={`exp-start-${index}`}
                    label="Fecha inicio"
                    type="date"
                    value={item.startDate}
                    onChange={(startDate) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, startDate } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <TextField
                    id={`exp-end-${index}`}
                    label="Fecha fin"
                    type="date"
                    value={item.endDate}
                    onChange={(endDate) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, endDate } : row,
                        ),
                      )
                    }
                    required={required && !item.isCurrent}
                    disabled={item.isCurrent}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.isCurrent}
                    onCheckedChange={(checked) =>
                      onChange(
                        items.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                isCurrent: checked === true,
                                endDate: checked === true ? "" : row.endDate,
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  Trabajo actualmente aquí
                </label>
                <div className="space-y-2">
                  <Label htmlFor={`exp-functions-${index}`}>Funciones</Label>
                  <Textarea
                    id={`exp-functions-${index}`}
                    rows={3}
                    value={item.functions}
                    onChange={(event) =>
                      onChange(
                        items.map((row, i) =>
                          i === index
                            ? { ...row, functions: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`exp-achievements-${index}`}>Logros</Label>
                  <Textarea
                    id={`exp-achievements-${index}`}
                    rows={3}
                    value={item.achievements}
                    onChange={(event) =>
                      onChange(
                        items.map((row, i) =>
                          i === index
                            ? { ...row, achievements: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: PublicEducationInput[];
  onChange: (items: PublicEducationInput[]) => void;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  function toggle(index: number) {
    setOpen((current) => ({ ...current, [index]: !current[index] }));
  }

  function addItem() {
    if (items.length >= MAX_PROFILE_SEGMENTS) return;
    const nextIndex = items.length;
    onChange([...items, emptyEducation()]);
    setOpen((current) => ({ ...current, [nextIndex]: true }));
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Formación académica</h3>
          <p className="text-xs text-muted-foreground">
            Hasta {MAX_PROFILE_SEGMENTS} formaciones. Solo la primera es
            obligatoria.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= MAX_PROFILE_SEGMENTS}
          onClick={addItem}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      {items.map((item, index) => {
        const required = index === 0;
        const expanded = open[index] ?? index === 0;
        const title =
          item.program.trim() ||
          item.institution.trim() ||
          `Formación ${index + 1}`;
        return (
          <div key={index} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              onClick={() => toggle(index)}
              aria-expanded={expanded}
            >
              <span className="truncate text-sm font-medium">
                {title}
                {required ? " *" : ""}
              </span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
            {expanded ? (
              <div className="space-y-3 border-t p-3">
                <div className="flex justify-end">
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onChange(items.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id={`edu-institution-${index}`}
                    label="Institución educativa"
                    value={item.institution}
                    onChange={(institution) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, institution } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <TextField
                    id={`edu-program-${index}`}
                    label="Nombre del programa"
                    value={item.program}
                    onChange={(program) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, program } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <FormSelect
                    id={`edu-level-${index}`}
                    label="Nivel de formación"
                    required={required}
                    value={item.educationLevel}
                    onChange={(educationLevel) =>
                      onChange(
                        items.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                educationLevel:
                                  educationLevel as EducationLevel | "",
                              }
                            : row,
                        ),
                      )
                    }
                    options={EDUCATION_OPTIONS}
                  />
                  <TextField
                    id={`edu-start-${index}`}
                    label="Fecha inicio"
                    type="date"
                    value={item.startDate}
                    onChange={(startDate) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, startDate } : row,
                        ),
                      )
                    }
                    required={required}
                  />
                  <TextField
                    id={`edu-end-${index}`}
                    label="Fecha fin"
                    type="date"
                    value={item.endDate}
                    onChange={(endDate) =>
                      onChange(
                        items.map((row, i) =>
                          i === index ? { ...row, endDate } : row,
                        ),
                      )
                    }
                    required={required && !item.isStudying}
                    disabled={item.isStudying}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.isStudying}
                    onCheckedChange={(checked) =>
                      onChange(
                        items.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                isStudying: checked === true,
                                endDate: checked === true ? "" : row.endDate,
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  Estudio actualmente aquí
                </label>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function applyParsedCv(
  current: PublicJobApplicationInput,
  parsed: ParsedPublicCv,
): PublicJobApplicationInput {
  const experiences = (parsed.workExperience ?? [])
    .filter(
      (item) =>
        Boolean(item.companyName?.trim()) || Boolean(item.positionTitle?.trim()),
    )
    .slice(0, MAX_PROFILE_SEGMENTS)
    .map((item) => ({
      companyName: item.companyName?.trim() ?? "",
      country: item.country?.trim() ?? "",
      positionTitle: item.positionTitle?.trim() ?? "",
      startDate: item.startDate?.trim() ?? "",
      endDate: item.endDate?.trim() ?? "",
      isCurrent: Boolean(item.isCurrent),
      functions: item.functions?.trim() ?? "",
      achievements: item.achievements?.trim() ?? "",
    }));
  const educations = (parsed.education ?? [])
    .filter(
      (item) =>
        Boolean(item.institution?.trim()) || Boolean(item.program?.trim()),
    )
    .slice(0, MAX_PROFILE_SEGMENTS)
    .map((item) => ({
      institution: item.institution?.trim() ?? "",
      program: item.program?.trim() ?? "",
      educationLevel: (item.educationLevel || "") as EducationLevel | "",
      startDate: item.startDate?.trim() ?? "",
      endDate: item.endDate?.trim() ?? "",
      isStudying: Boolean(item.isStudying),
    }));

  return {
    ...current,
    firstName: parsed.firstName?.trim() || current.firstName,
    lastName: parsed.lastName?.trim() || current.lastName,
    email: parsed.email?.trim() || current.email,
    phone: parsed.phone?.trim() || current.phone,
    documentType: parsed.documentType?.trim() || current.documentType,
    documentNumber: parsed.documentNumber?.trim() || current.documentNumber,
    professionalProfile:
      parsed.professionalProfile?.trim() || current.professionalProfile,
    linkedinUrl: parsed.linkedinUrl?.trim() || current.linkedinUrl,
    workExperience:
      experiences.length > 0 ? experiences : current.workExperience,
    education: educations.length > 0 ? educations : current.education,
  };
}

function hasParsedContact(parsed: ParsedPublicCv): boolean {
  return Boolean(
    parsed.firstName ||
      parsed.lastName ||
      parsed.email ||
      parsed.phone ||
      parsed.documentNumber ||
      parsed.professionalProfile ||
      parsed.linkedinUrl ||
      (parsed.workExperience?.length ?? 0) > 0 ||
      (parsed.education?.length ?? 0) > 0,
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "date";
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type={type}
        required={required}
        disabled={disabled}
        maxLength={type === "email" ? 255 : 200}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
