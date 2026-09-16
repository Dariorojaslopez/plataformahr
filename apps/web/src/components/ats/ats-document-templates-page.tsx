"use client";

import { OFFER_LETTER_PLACEHOLDERS } from "@talento/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { EmailHtmlEditor } from "@/components/ats/email-html-editor";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

type TemplateKind = "offer-letter" | "contract";

export function AtsDocumentTemplatesPageClient() {
  const companyId = useCompanyId();
  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (companyQuery.isError || !companyQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar las plantillas"
        description={getErrorMessage(
          companyQuery.error,
          "Inténtalo de nuevo.",
        )}
        onRetry={() => void companyQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <ThankYouLetterForm
        key={`thanks-${companyId}-${companyQuery.dataUpdatedAt}`}
        companyId={companyId}
        initialSubject={companyQuery.data.atsThankYouLetterSubject ?? ""}
        initialBody={companyQuery.data.atsThankYouLetterBody ?? ""}
      />
      <DocumentTemplatesSection
        key={`docs-${companyId}-${companyQuery.dataUpdatedAt}`}
        companyId={companyId}
        offerName={companyQuery.data.offerLetterTemplateOriginalName}
        contractName={companyQuery.data.contractTemplateOriginalName}
        hasOffer={Boolean(companyQuery.data.hasOfferLetterTemplate)}
        hasContract={Boolean(companyQuery.data.hasContractTemplate)}
        offerEmailSubject={companyQuery.data.atsOfferLetterEmailSubject ?? ""}
        offerEmailBody={companyQuery.data.atsOfferLetterEmailBody ?? ""}
      />
    </div>
  );
}

function ThankYouLetterForm({
  companyId,
  initialSubject,
  initialBody,
}: {
  companyId: string;
  initialSubject: string;
  initialBody: string;
}) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const saveMutation = useMutation({
    mutationFn: () =>
      companyApi.updateAtsSettings({
        atsThankYouLetterSubject: subject,
        atsThankYouLetterBody: body,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyKeys.current(companyId),
      });
      notifySuccess("Plantilla de agradecimiento guardada");
    },
    onError: (error) => {
      notifyError(error, "No se pudo guardar la plantilla.");
    },
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Carta de agradecimiento</h2>
        <p className="text-sm text-muted-foreground">
          Se envía por correo a los finalistas que no fueron contratados. Si
          dejas el cuerpo vacío, se usa el texto por defecto del sistema.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="thank-you-subject">Asunto</Label>
        <Input
          id="thank-you-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={200}
          placeholder="Gracias por participar…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thank-you-body">Cuerpo</Label>
        <Textarea
          id="thank-you-body"
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={8000}
          placeholder="Deja vacío para usar la plantilla por defecto del sistema."
        />
      </div>
      <Button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando…" : "Guardar carta"}
      </Button>
    </section>
  );
}

function DocumentTemplatesSection({
  companyId,
  offerName,
  contractName,
  hasOffer,
  hasContract,
  offerEmailSubject,
  offerEmailBody,
}: {
  companyId: string;
  offerName?: string | null;
  contractName?: string | null;
  hasOffer: boolean;
  hasContract: boolean;
  offerEmailSubject: string;
  offerEmailBody: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Carta oferta y contrato</h2>
        <p className="text-sm text-muted-foreground">
          La carta de oferta debe ser Word (.docx). El contrato admite PDF o
          DOCX (máx. 10 MB).
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TemplateCard
          companyId={companyId}
          kind="offer-letter"
          title="Carta de oferta"
          hasFile={hasOffer}
          fileName={offerName}
          emailSubject={offerEmailSubject}
          emailBody={offerEmailBody}
        />
        <TemplateCard
          companyId={companyId}
          kind="contract"
          title="Contrato"
          hasFile={hasContract}
          fileName={contractName}
        />
      </div>
    </section>
  );
}

function TemplateCard({
  companyId,
  kind,
  title,
  hasFile,
  fileName,
  emailSubject,
  emailBody,
}: {
  companyId: string;
  kind: TemplateKind;
  title: string;
  hasFile: boolean;
  fileName?: string | null;
  emailSubject?: string;
  emailBody?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: companyKeys.current(companyId),
    });
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => companyApi.uploadAtsTemplate(kind, file),
    onSuccess: async () => {
      await invalidate();
      notifySuccess(`${title} cargada`);
    },
    onError: (error) => {
      notifyError(error, `No se pudo cargar ${title.toLowerCase()}.`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => companyApi.removeAtsTemplate(kind),
    onSuccess: async () => {
      await invalidate();
      notifySuccess(`${title} eliminada`);
    },
    onError: (error) => {
      notifyError(error, `No se pudo eliminar ${title.toLowerCase()}.`);
    },
  });

  const busy = uploadMutation.isPending || removeMutation.isPending;
  const isOfferLetter = kind === "offer-letter";
  const accept = isOfferLetter
    ? ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  function handleSelectedFile(file: File) {
    if (isOfferLetter && !file.name.toLowerCase().endsWith(".docx")) {
      notifyError(
        new Error("La carta de oferta debe ser un archivo Word (.docx)."),
        "La carta de oferta debe ser un archivo Word (.docx).",
      );
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div
      className={`space-y-3 rounded-md border border-border p-4 ${
        isOfferLetter ? "lg:col-span-2" : ""
      }`}
    >
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {hasFile ? fileName || "Archivo cargado" : "Sin plantilla cargada"}
        </p>
        {isOfferLetter ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Obligatorio Word (.docx). En el documento usa variables con
              corchetes, exactamente así:
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {OFFER_LETTER_PLACEHOLDERS.map((item) => (
                <li
                  key={item.key}
                  className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                >
                  {item.token}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Formatos permitidos: PDF o DOCX.
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleSelectedFile(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {hasFile ? "Reemplazar" : "Subir"}
        </Button>
        {hasFile ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                try {
                  const { blob, filename } =
                    await companyApi.downloadAtsTemplate(kind);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download =
                    filename ||
                    fileName ||
                    (kind === "offer-letter" ? `${kind}.docx` : `${kind}.pdf`);
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  notifyError(error, "No se pudo descargar la plantilla.");
                }
              }}
            >
              Descargar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => removeMutation.mutate()}
            >
              Eliminar
            </Button>
          </>
        ) : null}
      </div>
      {isOfferLetter ? (
        <OfferLetterEmailForm
          companyId={companyId}
          initialSubject={emailSubject ?? ""}
          initialBody={emailBody ?? ""}
        />
      ) : null}
    </div>
  );
}

function OfferLetterEmailForm({
  companyId,
  initialSubject,
  initialBody,
}: {
  companyId: string;
  initialSubject: string;
  initialBody: string;
}) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const saveMutation = useMutation({
    mutationFn: () =>
      companyApi.updateAtsSettings({
        atsOfferLetterEmailSubject: subject,
        atsOfferLetterEmailBody: body,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyKeys.current(companyId),
      });
      notifySuccess("Correo de envío de plantilla guardado");
    },
    onError: (error) => {
      notifyError(error, "No se pudo guardar el correo.");
    },
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h4 className="font-medium">
          Configuración de correo de envío de plantilla
        </h4>
        <p className="text-sm text-muted-foreground">
          Este correo acompañará el envío de la carta de oferta. Puedes cambiar
          la fuente y pegar o insertar un logo.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-letter-email-subject">Asunto</Label>
        <Input
          id="offer-letter-email-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={200}
          placeholder="Te hacemos una oferta…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-letter-email-body">Cuerpo del mensaje</Label>
        <EmailHtmlEditor
          id="offer-letter-email-body"
          value={body}
          onChange={setBody}
          disabled={saveMutation.isPending}
        />
      </div>
      <Button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando…" : "Guardar correo"}
      </Button>
    </div>
  );
}
