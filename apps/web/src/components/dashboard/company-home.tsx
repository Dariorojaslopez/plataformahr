"use client";

import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  LayoutGrid,
  ListChecks,
  Medal,
  Network,
  Palette,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Upload,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CollaboratorHome } from "@/components/dashboard/collaborator-home";
import { CompanyInfoPanel } from "@/components/dashboard/company-info-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  HOME_ROLE_LABELS,
  groupedHomeShortcuts,
  homeDescription,
  type HomeShortcut,
} from "@/lib/home/home-view";
import type { CompanyHomeRole } from "@talento/shared";

const SHORTCUT_ICONS: Record<string, LucideIcon> = {
  "/performance/my-evaluations": ClipboardList,
  "/performance/my-results": Medal,
  "/my-goals": Medal,
  "/ats/vacancy-requests": ClipboardList,
  "/goals/team": Users,
  "/organization/org-chart": Share2,
  "/ats/vacancies": BriefcaseBusiness,
  "/ats/candidates": Users,
  "/ats/pipeline": GitBranch,
  "/ats/interviews": CalendarDays,
  "/organization/employees": Users,
  "/organization/business-units": Building2,
  "/organization/areas": Network,
  "/organization/positions": BriefcaseBusiness,
  "/organization/job-levels": Layers3,
  "/organization/competencies": Target,
  "/organization/scales": SlidersHorizontal,
  "/organization/position-fields": ListChecks,
  "/organization/import": Upload,
  "/ats/settings/approvals": ShieldCheck,
  "/ats/settings/evaluators": UserCheck,
  "/ats/settings/active-processes": ListChecks,
  "/ats/interview-templates": FileText,
  "/performance/cycles": Gauge,
  "/performance/population": UserCheck,
  "/performance/calibration": LayoutGrid,
  "/performance/scales": SlidersHorizontal,
  "/goals": Target,
  "/organization/settings": Settings2,
  "/settings/branding": Palette,
  "/performance/results": Medal,
  "/performance/competencies": Target,
  "/goals/cycles": CalendarDays,
  "/goals/reviews": ClipboardList,
};

export type CompanyHomeProps = {
  firstName: string;
  companyName: string;
  companySlug: string;
  homeRole: CompanyHomeRole;
  hasDirectReports: boolean;
  shortcuts: HomeShortcut[];
};

export function CompanyHome({
  firstName,
  companyName,
  companySlug,
  homeRole,
  hasDirectReports,
  shortcuts,
}: CompanyHomeProps) {
  const greeting = firstName.trim() ? `Hola, ${firstName.trim()}` : "Hola";
  const isPeopleHome =
    homeRole === "COLLABORATOR" || homeRole === "LEADER";
  const isRecruiterHome = homeRole === "RECRUITER";
  const isAdminHome = homeRole === "CLIENT_ADMIN";
  const usesFeedHome = isPeopleHome || isRecruiterHome || isAdminHome;
  const configSections = isAdminHome ? groupedHomeShortcuts(shortcuts) : [];

  return (
    <div>
      <PageHeader
        title={greeting}
        description={homeDescription(homeRole, companyName)}
        actions={
          <Badge variant="secondary">{HOME_ROLE_LABELS[homeRole]}</Badge>
        }
      />

      {homeRole === "LEADER" && !hasDirectReports ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Personas a cargo</CardTitle>
            <CardDescription>
              Aún no tienes reportes directos en el organigrama. Cuando se
              asignen, aparecerán en Mi equipo y en el organigrama.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {homeRole === "CLIENT_ADMIN" ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Compañía activa</CardTitle>
            <CardDescription>
              Estás administrando esta compañía con visibilidad completa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{companyName || "—"}</p>
            {companySlug ? (
              <p className="text-muted-foreground">{companySlug}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          {usesFeedHome ? (
            <CollaboratorHome
              canRequestVacancies={homeRole === "LEADER"}
              showAssignedWork={isRecruiterHome}
              showAllProcesses={isAdminHome}
            />
          ) : null}

          {isAdminHome ? (
            <div className={usesFeedHome ? "mt-8 space-y-8" : "space-y-8"}>
              {configSections.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No hay accesos de configuración habilitados en esta compañía.
                  </CardContent>
                </Card>
              ) : (
                configSections.map((section) => (
                  <section key={section.group} className="space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">{section.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.items.map((item) => (
                        <StatCard
                          key={item.href}
                          title={item.title}
                          description={item.description}
                          href={item.href}
                          icon={SHORTCUT_ICONS[item.href] ?? Target}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          ) : usesFeedHome ? null : shortcuts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay accesos habilitados para tu rol en esta compañía.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map((item) => (
                <StatCard
                  key={item.href}
                  title={item.title}
                  description={item.description}
                  href={item.href}
                  icon={SHORTCUT_ICONS[item.href] ?? Target}
                />
              ))}
            </div>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <CompanyInfoPanel canManage={isAdminHome} />
        </div>
      </div>
    </div>
  );
}
