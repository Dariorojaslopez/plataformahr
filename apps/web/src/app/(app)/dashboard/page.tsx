"use client";

import { Building2, ClipboardList, Gauge, Users } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { user, activeCompany } = useSession();

  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.firstName ?? ""}`}
        description={
          activeCompany
            ? `Trabajando en ${activeCompany.name}`
            : "Selecciona una compañía para continuar"
        }
      />

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compañía activa</CardTitle>
            <CardDescription>
              El backend valida cada request con el header X-Company-Id.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{activeCompany?.name ?? "—"}</p>
            <p className="text-muted-foreground">{activeCompany?.slug ?? ""}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Organización"
          description="Estructura, cargos y colaboradores."
          href="/organization/employees"
          icon={Users}
        />
        <StatCard
          title="ATS"
          description="Vacantes, candidatos y pipeline."
          href="/ats/vacancy-requests"
          icon={ClipboardList}
        />
        <StatCard
          title="Performance"
          description="Módulo de desempeño en construcción."
          icon={Gauge}
          soon
        />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-md bg-muted p-2">
              <Building2 className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
              <CardDescription>
                Las pantallas de detalle se habilitarán en las siguientes fases.
                No se muestran métricas inventadas.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
