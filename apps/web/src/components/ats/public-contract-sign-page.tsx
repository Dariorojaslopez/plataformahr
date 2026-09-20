"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { publicApiAssetUrl } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import {
  publicContractApi,
  publicContractDocumentUrl,
} from "@/lib/api/offers";

const SIGN_ACCEPT =
  ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export function PublicContractSignPage({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);

  const query = useQuery({
    queryKey: ["public-contract", token],
    queryFn: () => publicContractApi.get(token),
  });

  const signMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Adjunta una imagen de tu firma.");
      return publicContractApi.sign(token, file, accepted);
    },
    onSuccess: (data) => {
      query.refetch().catch(() => undefined);
      return data;
    },
  });

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Enlace no válido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este enlace de firma no es válido o ya venció.
        </p>
      </main>
    );
  }

  const contract = query.data;
  const documentUrl = publicApiAssetUrl(publicContractDocumentUrl(token));
  const isPdf = contract.documentMime === "application/pdf";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{contract.companyName}</p>
        <h1 className="text-2xl font-semibold">Contrato</h1>
        <p className="text-sm text-muted-foreground">
          {contract.candidateName} · {contract.positionTitle}
        </p>
      </header>

      <section className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Documento diligenciado</h2>
        {isPdf ? (
          <iframe
            title="Contrato"
            src={documentUrl}
            className="h-[70vh] w-full rounded-md border border-border bg-card"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Previsualiza o descarga el documento Word.
          </p>
        )}
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={documentUrl} target="_blank" rel="noreferrer">
            Descargar documento
          </a>
        </Button>
      </section>

      {contract.signed ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          Contrato firmado
          {contract.signedAt
            ? ` el ${new Date(contract.signedAt).toLocaleString("es-CO")}`
            : ""}
          . Ya puedes cerrar esta página.
        </p>
      ) : (
        <form
          className="space-y-4 rounded-lg border border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            signMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="contract-signature">Imagen de tu firma</Label>
            <input
              id="contract-signature"
              type="file"
              accept={SIGN_ACCEPT}
              className="block w-full text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={accepted}
              onCheckedChange={(value) => setAccepted(value === true)}
              aria-label="Aceptar contrato"
            />
            <span>
              Acepto este contrato y autorizo guardar una copia firmada con la
              imagen adjunta.
            </span>
          </label>
          {signMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                signMutation.error,
                "No se pudo guardar la firma.",
              )}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={!accepted || !file || signMutation.isPending}
          >
            {signMutation.isPending ? "Guardando…" : "Guardar firma"}
          </Button>
        </form>
      )}
    </main>
  );
}
