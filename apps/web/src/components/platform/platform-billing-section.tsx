"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  platformBillingRequest,
  updateManagedCompanyBillingRequest,
} from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCop, type CompanyBillingItem } from "@/lib/platform/billing";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export function PlatformBillingSection() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["platform", "billing"],
    queryFn: () => platformBillingRequest(),
  });
  const [editing, setEditing] = useState<CompanyBillingItem | null>(null);

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No se pudo cargar la facturación"
        description={getErrorMessage(query.error, "Inténtalo de nuevo.")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { items, totals } = query.data;

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturación</CardTitle>
          <CardDescription>
            Costos por compañía (impuestos, licencias y suscripciones), margen y
            el monto cobrado calculado. El reporte consolidado muestra la
            ganancia neta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay compañías para facturar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compañía</TableHead>
                  <TableHead>Impuestos</TableHead>
                  <TableHead>Licencias</TableHead>
                  <TableHead>Suscripciones</TableHead>
                  <TableHead>% margen</TableHead>
                  <TableHead>Monto cobrado</TableHead>
                  <TableHead>Ganancia neta</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.companyId}>
                    <TableCell className="font-medium">
                      {item.companyName}
                    </TableCell>
                    <TableCell>{formatCop(item.taxAmount)}</TableCell>
                    <TableCell>{formatCop(item.licenseAmount)}</TableCell>
                    <TableCell>{formatCop(item.subscriptionAmount)}</TableCell>
                    <TableCell>{item.marginPercent}%</TableCell>
                    <TableCell>{formatCop(item.chargedAmount)}</TableCell>
                    <TableCell>{formatCop(item.netProfit)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(item)}
                      >
                        Editar costos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Consolidado</TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className="font-semibold">
                    {formatCop(totals.chargedAmount)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCop(totals.netProfit)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing ? (
          <BillingEditorForm
            key={editing.companyId}
            item={editing}
            onSaved={async () => {
              await queryClient.invalidateQueries({
                queryKey: ["platform", "billing"],
              });
              setEditing(null);
            }}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function BillingEditorForm({
  item,
  onSaved,
}: {
  item: CompanyBillingItem;
  onSaved: () => Promise<void>;
}) {
  const [taxAmount, setTaxAmount] = useState(item.taxAmount);
  const [licenseAmount, setLicenseAmount] = useState(item.licenseAmount);
  const [subscriptionAmount, setSubscriptionAmount] = useState(
    item.subscriptionAmount,
  );
  const [marginPercent, setMarginPercent] = useState(item.marginPercent);

  const mutation = useMutation({
    mutationFn: () =>
      updateManagedCompanyBillingRequest(item.companyId, {
        taxAmount,
        licenseAmount,
        subscriptionAmount,
        marginPercent,
      }),
    onSuccess: async () => {
      notifySuccess("Costos de facturación guardados.");
      await onSaved();
    },
    onError: (error) =>
      notifyError(error, "No se pudieron guardar los costos."),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Costos de {item.companyName}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="billing-tax"
          label="Impuestos"
          value={taxAmount}
          onChange={setTaxAmount}
        />
        <MoneyField
          id="billing-license"
          label="Licencias"
          value={licenseAmount}
          onChange={setLicenseAmount}
        />
        <MoneyField
          id="billing-subscription"
          label="Suscripciones"
          value={subscriptionAmount}
          onChange={setSubscriptionAmount}
        />
        <MoneyField
          id="billing-margin"
          label="% de margen"
          value={marginPercent}
          onChange={setMarginPercent}
        />
      </div>
      <DialogFooter>
        <Button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
