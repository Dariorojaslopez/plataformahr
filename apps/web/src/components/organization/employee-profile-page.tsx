"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  EmployeeForm,
  toUpdatePayload,
  type EmployeeFormValues,
} from "@/components/organization/employee-form";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { getInitials } from "@/lib/utils";
import type { ReportingLineType } from "@/types/organization";

export function EmployeeProfilePageClient() {
  const companyId = useCompanyId();
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [reportType, setReportType] = useState<ReportingLineType>("DIRECT");
  const [reportError, setReportError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: orgKeys.employeeProfile(companyId, employeeId),
    queryFn: () => organizationApi.getOrganizationProfile(employeeId),
  });
  const employeeQuery = useQuery({
    queryKey: orgKeys.employee(companyId, employeeId),
    queryFn: () => organizationApi.getEmployee(employeeId),
  });
  const reportingQuery = useQuery({
    queryKey: orgKeys.reportingLines(companyId, employeeId),
    queryFn: () => organizationApi.listReportingLines(employeeId),
  });
  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, { page: 1, limit: 100 }),
    queryFn: () => organizationApi.listEmployees({ page: 1, limit: 100 }),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });
  const buQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });

  const managerOptions = useMemo(() => {
    return (employeesQuery.data?.items ?? [])
      .filter((employee) => employee.id !== employeeId)
      .map((employee) => ({
        value: employee.id,
        label: `${employee.firstName} ${employee.lastName}`,
      }));
  }, [employeesQuery.data, employeeId]);

  const updateMutation = useMutation({
    mutationFn: (values: EmployeeFormValues) =>
      organizationApi.updateEmployee(employeeId, toUpdatePayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      setEditOpen(false);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo actualizar."));
    },
  });

  const addReportMutation = useMutation({
    mutationFn: () =>
      organizationApi.createReportingLine(employeeId, {
        managerEmployeeId: managerId,
        type: reportType,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      setReportOpen(false);
      setManagerId("");
      setReportType("DIRECT");
      setReportError(null);
    },
    onError: (error) => {
      setReportError(
        getErrorMessage(error, "No se pudo agregar la línea de reporte."),
      );
    },
  });

  const removeReportMutation = useMutation({
    mutationFn: (reportingLineId: string) =>
      organizationApi.deleteReportingLine(employeeId, reportingLineId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
    },
  });

  if (profileQuery.isLoading || employeeQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (profileQuery.isError || employeeQuery.isError || !profileQuery.data) {
    return (
      <ErrorState
        title="Colaborador no encontrado"
        description={getErrorMessage(
          profileQuery.error ?? employeeQuery.error,
          "No se pudo cargar el perfil.",
        )}
        action={
          <Button asChild type="button" variant="outline">
            <Link href="/organization/employees">Volver</Link>
          </Button>
        }
      />
    );
  }

  const profile = profileQuery.data;
  const employee = employeeQuery.data;
  const lines = reportingQuery.data ?? [];
  const direct = lines.filter((line) => line.type === "DIRECT");
  const indirect = lines.filter((line) => line.type === "INDIRECT");

  return (
    <div>
      <PageHeader
        title={`${profile.firstName} ${profile.lastName}`}
        description="Perfil organizacional del colaborador"
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {getInitials(profile.firstName, profile.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-xl font-semibold">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-sm">
              {profile.position.name} · {profile.area.name}
            </p>
            <OrgStatusBadge status={profile.status} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Email" value={employee?.email} />
            <InfoRow label="Teléfono" value={employee?.phone} />
            <InfoRow
              label="Nacimiento"
              value={employee?.birthDate?.slice(0, 10)}
            />
            <InfoRow label="País" value={employee?.country} />
            <InfoRow label="Estado" value={employee?.state} />
            <InfoRow label="Ciudad" value={employee?.city} />
            <InfoRow label="Estado civil" value={employee?.maritalStatus} />
            <InfoRow
              label="Hijos"
              value={
                employee?.childrenCount === null ||
                employee?.childrenCount === undefined
                  ? null
                  : String(employee.childrenCount)
              }
            />
            <InfoRow label="Vivienda" value={employee?.housingType} />
            <InfoRow
              label="Contacto emergencia"
              value={employee?.emergencyContactName}
            />
            <InfoRow
              label="Tel. emergencia"
              value={employee?.emergencyContactPhone}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Información organizacional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow
              label="Unidad de negocio"
              value={profile.businessUnit?.name}
            />
            <InfoRow label="Área" value={profile.area.name} />
            <InfoRow label="Cargo" value={profile.position.name} />
            <InfoRow label="Nivel" value={profile.jobLevel?.name} />
            <InfoRow
              label="Ingreso"
              value={profile.hireDate?.slice(0, 10) ?? employee?.hireDate?.slice(0, 10)}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Línea de reporte</CardTitle>
            <CardDescription>
              Líder directo e indirectos según relaciones existentes.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setReportError(null);
              setReportOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar líder
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Líder directo
            </p>
            {direct.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin líder directo.</p>
            ) : (
              direct.map((line) => (
                <ManagerRow
                  key={line.id}
                  name={`${line.manager.firstName} ${line.manager.lastName}`}
                  email={line.manager.email}
                  onRemove={() => {
                    if (
                      window.confirm(
                        "¿Eliminar esta relación de reporte?",
                      )
                    ) {
                      removeReportMutation.mutate(line.id);
                    }
                  }}
                />
              ))
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Líderes indirectos
            </p>
            {indirect.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin líderes indirectos.
              </p>
            ) : (
              <div className="space-y-2">
                {indirect.map((line) => (
                  <ManagerRow
                    key={line.id}
                    name={`${line.manager.firstName} ${line.manager.lastName}`}
                    email={line.manager.email}
                    onRemove={() => {
                      if (
                        window.confirm(
                          "¿Eliminar esta relación de reporte?",
                        )
                      ) {
                        removeReportMutation.mutate(line.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {removeReportMutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                removeReportMutation.error,
                "No se pudo eliminar la relación.",
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <EntityEditorShell
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar colaborador"
      >
        {employee ? (
          <EmployeeForm
            key={employee.id}
            initial={employee}
            areas={areasQuery.data ?? []}
            positions={positionsQuery.data ?? []}
            businessUnits={buQuery.data ?? []}
            submitting={updateMutation.isPending}
            error={formError}
            onCancel={() => setEditOpen(false)}
            onSubmit={(values) => updateMutation.mutate(values)}
          />
        ) : null}
      </EntityEditorShell>

      <EntityEditorShell
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Agregar líder"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!managerId) {
              setReportError("Selecciona un líder.");
              return;
            }
            addReportMutation.mutate();
          }}
        >
          <FormSelect
            id="manager"
            label="Líder"
            required
            value={managerId}
            onChange={setManagerId}
            options={managerOptions}
          />
          <FormSelect
            id="report-type"
            label="Tipo"
            value={reportType}
            onChange={(value) => setReportType(value as ReportingLineType)}
            options={[
              { value: "DIRECT", label: "Directo" },
              { value: "INDIRECT", label: "Indirecto" },
            ]}
          />
          {reportError ? (
            <p className="text-sm text-destructive" role="alert">
              {reportError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={addReportMutation.isPending}>
              {addReportMutation.isPending ? "Guardando…" : "Agregar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function ManagerRow({
  name,
  email,
  onRemove,
}: {
  name: string;
  email: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Eliminar relación con ${name}`}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
