"use client";

import { CANDIDATE_DOCUMENT_TYPES } from "@talento/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBaseUrl } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { publicJobsApi } from "@/lib/api/ats";
import { brandCssVars, companyInitials } from "@/lib/company/brand-tokens";
import { PublicJobContent } from "@/components/ats/public-job-content";
import type {
  ParsedPublicCv,
  PublicJob,
  PublicJobApplicationInput,
} from "@/types/ats";

const emptyForm: PublicJobApplicationInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentType: "",
  documentNumber: "",
};

export function PublicJobPage({
  publicId,
  job: jobOverride,
  preview = false,
}: {
  publicId?: string;
  job?: PublicJob;
  preview?: boolean;
}) {
  const [form, setForm] = useState(emptyForm);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvHint, setCvHint] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const jobQuery = useQuery({
    queryKey: ["public-job", publicId],
    queryFn: () => publicJobsApi.get(publicId!),
    enabled: Boolean(publicId) && !jobOverride,
    retry: false,
  });
  const applyMutation = useMutation({
    mutationFn: () => publicJobsApi.apply(publicId!, form, cvFile ?? undefined),
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

  const job = jobOverride ?? jobQuery.data;
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
          <p className="text-sm font-medium text-primary">Talento</p>
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
  const update = (field: keyof PublicJobApplicationInput, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <main
      className="min-h-screen bg-muted/30"
      style={brandCssVars(job.brandPrimaryColor, {
        dark: resolvedTheme === "dark",
      })}
    >
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-6">
          {job.hasLogo && logoPublicId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${getApiBaseUrl()}/public/jobs/${encodeURIComponent(logoPublicId)}/logo`}
              alt={`Logo de ${job.companyName}`}
              className="size-12 rounded-md object-contain"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground">
              {companyInitials(job.companyName)}
            </div>
          )}
          <div>
            <p className="font-semibold">{job.companyName}</p>
            <p className="text-sm text-muted-foreground">Oportunidades laborales</p>
          </div>
        </div>
      </header>

      {preview ? (
        <p className="border-b bg-muted px-6 py-2 text-center text-sm text-muted-foreground">
          Vista previa de la página pública
          {job.publishedAt ? "" : " — aún no está publicada"}
        </p>
      ) : null}

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_24rem]">
        <PublicJobContent job={job} />

        {preview ? (
          <aside className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            En la publicación real, los candidatos subirán su hoja de vida y
            verán aquí el formulario de postulación.
          </aside>
        ) : (
          <aside className="rounded-xl border bg-card p-6">
            {applyMutation.isSuccess ? (
              <div className="space-y-3 text-center" role="status">
                <CheckCircle2 className="mx-auto size-10 text-success" />
                <h2 className="text-xl font-semibold">Postulación recibida</h2>
                <p className="text-sm text-muted-foreground">
                  Gracias por tu interés. El equipo revisará tu información.
                </p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    !cvFile ||
                    applyMutation.isPending ||
                    parseCvMutation.isPending
                  ) {
                    return;
                  }
                  applyMutation.mutate();
                }}
              >
              <h2 className="text-xl font-semibold">Postúlate</h2>
              <div className="space-y-2">
                <Label htmlFor="job-cv">Hoja de vida *</Label>
                <Input
                  id="job-cv"
                  type="file"
                  required
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file || !publicId) return;
                    parseCvMutation.mutate(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {cvFile
                    ? cvFile.name
                    : "PDF, DOCX o TXT. Completaremos el formulario con lo que podamos leer."}
                </p>
                {parseCvMutation.isPending ? (
                  <p className="text-xs text-muted-foreground">
                    Leyendo hoja de vida…
                  </p>
                ) : null}
                {cvHint ? (
                  <p className="text-xs text-muted-foreground">{cvHint}</p>
                ) : null}
              </div>
              <TextField
                  id="job-first-name"
                  label="Nombres"
                  value={form.firstName}
                  onChange={(value) => update("firstName", value)}
                />
                <TextField
                  id="job-last-name"
                  label="Apellidos"
                  value={form.lastName}
                  onChange={(value) => update("lastName", value)}
                />
                <TextField
                  id="job-email"
                  label="Correo electrónico"
                  type="email"
                  value={form.email}
                  onChange={(value) => update("email", value)}
                />
                <TextField
                  id="job-phone"
                  label="Teléfono"
                  type="tel"
                  value={form.phone}
                  onChange={(value) => update("phone", value)}
                />
                <FormSelect
                  id="job-document-type"
                  label="Tipo de documento"
                  required
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
                />
                {applyMutation.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {getErrorMessage(
                      applyMutation.error,
                      "No fue posible registrar la postulación.",
                    )}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                  applyMutation.isPending || parseCvMutation.isPending || !cvFile
                }
                >
                  {applyMutation.isPending ? "Enviando…" : "Enviar postulación"}
                </Button>
              </form>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

function applyParsedCv(
  current: PublicJobApplicationInput,
  parsed: ParsedPublicCv,
): PublicJobApplicationInput {
  return {
    firstName: parsed.firstName?.trim() || current.firstName,
    lastName: parsed.lastName?.trim() || current.lastName,
    email: parsed.email?.trim() || current.email,
    phone: parsed.phone?.trim() || current.phone,
    documentType: parsed.documentType?.trim() || current.documentType,
    documentNumber: parsed.documentNumber?.trim() || current.documentNumber,
  };
}

function hasParsedContact(parsed: ParsedPublicCv): boolean {
  return Boolean(
    parsed.firstName ||
      parsed.lastName ||
      parsed.email ||
      parsed.phone ||
      parsed.documentNumber,
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <Input
        id={id}
        type={type}
        required
        maxLength={type === "email" ? 255 : 100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
