"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
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
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  Employee,
  EmployeeAccessIssued,
  EmployeeAccessRole,
} from "@/types/organization";

const ACCESS_ROLES: { value: EmployeeAccessRole; label: string }[] = [
  { value: "LEADER", label: "Líder (puede aprobar vacantes)" },
  { value: "RECRUITER", label: "Reclutador" },
  { value: "COLLABORATOR", label: "Colaborador" },
];

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
  const [roleCode, setRoleCode] = useState<EmployeeAccessRole>("LEADER");
  const [issued, setIssued] = useState<EmployeeAccessIssued | null>(null);

  useEffect(() => {
    if (!open) {
      setIssued(null);
      setRoleCode("LEADER");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!employee) {
        throw new Error("Sin colaborador");
      }
      return organizationApi.issueEmployeeAccess(employee.id, roleCode);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crea o restablece el usuario y muestra una contraseña temporal.
              Elige Líder si esta persona debe aprobar vacantes.
            </p>
            <FormSelect
              id="access-role"
              label="Rol"
              value={roleCode}
              onChange={(value) => setRoleCode(value as EmployeeAccessRole)}
              options={ACCESS_ROLES}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
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
