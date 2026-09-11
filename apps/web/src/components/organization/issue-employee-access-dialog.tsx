"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompanyId } from "@/hooks/use-company-id";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { COMPANY_ROLE_LABELS } from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Employee, EmployeeAccessIssued } from "@/types/organization";

type IssueEmployeeAccessDialogProps = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IssueEmployeeAccessDialog({
  employee,
  open,
  onOpenChange,
}: IssueEmployeeAccessDialogProps) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<EmployeeAccessIssued | null>(null);
  const roleLabel = employee
    ? (COMPANY_ROLE_LABELS[employee.accessRoleCode] ?? employee.accessRoleCode)
    : null;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setIssued(null);
    }
    onOpenChange(next);
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (!employee) {
        throw new Error("Sin colaborador");
      }
      return organizationApi.issueEmployeeAccess(employee.id);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      setIssued(result);
      notifySuccess(
        result.passwordEmailed
          ? "Acceso creado y correo enviado"
          : "Acceso creado. Copia la contraseña; el correo no se envió.",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo generar el acceso.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {issued ? "Contraseña temporal" : "Dar acceso al sistema"}
          </DialogTitle>
          {employee ? (
            <p className="text-sm text-muted-foreground">
              {employee.firstName} {employee.lastName} · {employee.email}
            </p>
          ) : null}
        </DialogHeader>

        {issued ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {issued.passwordEmailed
                ? "También se envió al email del colaborador. Cópiala ahora por si el correo no llega."
                : "El correo no se envió. Copia la contraseña y entrégala por un canal seguro."}
            </p>
            <p className="break-all font-mono text-sm">
              {issued.temporaryPassword}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(issued.temporaryPassword)
                    .then(() => notifySuccess("Contraseña copiada"))
                }
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea o restablece el usuario y muestra una contraseña temporal.
              El rol se asigna en la ficha del colaborador
              {roleLabel ? ` (ahora: ${roleLabel})` : ""}.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!employee || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Generando…" : "Generar contraseña"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
