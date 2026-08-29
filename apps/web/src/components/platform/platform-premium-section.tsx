"use client";

import type { PremiumFeatureCode } from "@talento/shared";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateManagedCompanyPremiumRequest } from "@/lib/api/auth";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ManagedCompany } from "@/types/auth";

const PREMIUM_COLUMNS: Array<{
  code: PremiumFeatureCode;
  label: string;
  field: "digitalSignature" | "interviewRecording" | "pdi";
}> = [
  {
    code: "premium.digital-signature",
    label: "Firma digital",
    field: "digitalSignature",
  },
  {
    code: "premium.interview-recording",
    label: "Grabación de entrevista",
    field: "interviewRecording",
  },
  { code: "premium.pdi", label: "Generación de PDI", field: "pdi" },
];

function flagsFromFeatures(features: string[]) {
  return {
    digitalSignature: features.includes("premium.digital-signature"),
    interviewRecording: features.includes("premium.interview-recording"),
    pdi: features.includes("premium.pdi"),
  };
}

export function PlatformPremiumSection({
  companies,
  onSaved,
}: {
  companies: ManagedCompany[];
  onSaved: () => Promise<void>;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function toggle(
    company: ManagedCompany,
    field: (typeof PREMIUM_COLUMNS)[number]["field"],
    next: boolean,
  ) {
    const current = flagsFromFeatures(company.enabledFeatures);
    setPendingKey(`${company.id}:${field}`);
    try {
      await updateManagedCompanyPremiumRequest(company.id, {
        ...current,
        [field]: next,
      });
      await onSaved();
      notifySuccess(`Opciones premium de ${company.name} actualizadas`);
    } catch (error) {
      notifyError(error, "No se pudieron actualizar las opciones premium.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opciones premium</CardTitle>
          <CardDescription>
            Enciende o apaga por compañía la firma digital, la grabación de
            entrevistas y la generación de PDI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crea una compañía para configurar opciones premium.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compañía</TableHead>
                  {PREMIUM_COLUMNS.map((column) => (
                    <TableHead key={column.code}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const flags = flagsFromFeatures(company.enabledFeatures);
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.name}
                      </TableCell>
                      {PREMIUM_COLUMNS.map((column) => (
                        <TableCell key={column.code}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={flags[column.field]}
                              disabled={
                                pendingKey === `${company.id}:${column.field}`
                              }
                              onChange={(event) =>
                                void toggle(
                                  company,
                                  column.field,
                                  event.target.checked,
                                )
                              }
                            />
                            {flags[column.field] ? "Activa" : "Apagada"}
                          </label>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
