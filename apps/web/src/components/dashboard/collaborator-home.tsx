"use client";

import { CANDIDATE_DOCUMENT_TYPES, candidateDocumentTypeLabel } from "@talento/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { RequestVacancyDialog } from "@/components/dashboard/request-vacancy-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import {
  homeApi,
  homeKeys,
  EMPTY_ASSIGNED_METRICS,
  type HomeAssignedMetrics,
  type HomeAssignedVacancy,
  type HomeOpenVacancy,
  type HomePendingApproval,
  type HomeProfile,
  type UpdateHomeProfileInput,
} from "@/lib/api/home";
import { FormSelect } from "@/components/organization/form-select";
import {
  VACANCY_STATUS_LABELS,
  formatEmployeeName,
  vacancyStatusVariant,
} from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Vacancy, VacancyStatus } from "@/types/ats";

export function CollaboratorHome({
  canRequestVacancies = false,
  showAssignedWork = false,
  showAllProcesses = false,
}: {
  canRequestVacancies?: boolean;
  showAssignedWork?: boolean;
  showAllProcesses?: boolean;
}) {
  const companyId = useCompanyId();
  const features = new Set(
    useSession().companyAccess?.enabledFeatures ?? [],
  );
  const [requestOpen, setRequestOpen] = useState(false);
  const feedQuery = useQuery({
    queryKey: homeKeys.feed(companyId),
    queryFn: () => homeApi.getFeed(),
  });

  if (feedQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (feedQuery.isError || !feedQuery.data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {getErrorMessage(
            feedQuery.error,
            "No se pudo cargar tu inicio.",
          )}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void feedQuery.refetch()}
            >
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const feed = feedQuery.data;
  const showRequestButton =
    canRequestVacancies && features.has("ats.vacancy-requests");

  return (
    <div className="space-y-8">
      {showRequestButton ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Si tu equipo necesita cubrir un cargo, solicita el proceso desde
              aquí.
            </p>
            <Button type="button" onClick={() => setRequestOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Solicitar proceso de selección
            </Button>
          </div>
          <RequestVacancyDialog
            open={requestOpen}
            onOpenChange={setRequestOpen}
            linkedEmployeeExists={Boolean(feed.profile)}
          />
        </>
      ) : null}
      <OpenVacanciesSection vacancies={feed.openVacancies} profile={feed.profile} />
      <ProfileSection profile={feed.profile} />
      {features.has("ats.vacancy-requests") && feed.pendingApprovals.length > 0 ? (
        <ApprovalsSection items={feed.pendingApprovals} />
      ) : null}
      {features.has("ats.interviews") && feed.pendingEvaluations.length > 0 ? (
        <EvaluationsSection items={feed.pendingEvaluations} />
      ) : null}
      {showAssignedWork ? (
        <>
          <AssignedVacanciesSection
            items={feed.assignedVacancies ?? []}
          />
          <AssignedMetricsSection
            metrics={feed.assignedMetrics ?? EMPTY_ASSIGNED_METRICS}
          />
        </>
      ) : null}
      {showAllProcesses && features.has("ats.vacancies") ? (
        <AllProcessesSection />
      ) : null}
    </div>
  );
}

function OpenVacanciesSection({
  vacancies,
  profile,
}: {
  vacancies: HomeOpenVacancy[];
  profile: HomeProfile | null;
}) {
  const [selected, setSelected] = useState<HomeOpenVacancy | null>(null);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Procesos de selección activos</h2>
        <p className="text-sm text-muted-foreground">
          Vacantes abiertas de la compañía. Postúlate sin salir de la herramienta.
        </p>
      </div>
      {vacancies.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No hay procesos de selección abiertos en este momento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {vacancies.map((vacancy) => (
            <Card key={vacancy.id}>
              <CardHeader>
                <CardTitle className="text-base">{vacancy.title}</CardTitle>
                <CardDescription>{vacancy.areaName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {vacancy.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {vacancy.description}
                  </p>
                ) : null}
                <Button type="button" size="sm" onClick={() => setSelected(vacancy)}>
                  Postularme
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ApplyDialog
        vacancy={selected}
        profile={profile}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function ApplyDialog({
  vacancy,
  profile,
  onClose,
}: {
  vacancy: HomeOpenVacancy | null;
  profile: HomeProfile | null;
  onClose: () => void;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  const needsPhone = Boolean(vacancy) && !(profile?.phone && profile.phone.length >= 5);
  const needsDocument =
    Boolean(vacancy) &&
    !(profile?.documentType && (profile.documentNumber?.length ?? 0) >= 3);

  const applyMutation = useMutation({
    mutationFn: () =>
      homeApi.applyToVacancy(vacancy!.id, {
        ...(needsPhone ? { phone } : {}),
        ...(needsDocument ? { documentType, documentNumber } : {}),
      }),
    onSuccess: async () => {
      notifySuccess("Postulación enviada");
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
      onClose();
    },
    onError: (error) => {
      notifyError(error, "No se pudo enviar la postulación.");
    },
  });

  return (
    <Dialog
      open={Boolean(vacancy)}
      onOpenChange={(open) => {
        if (!open) onClose();
        else {
          setPhone(profile?.phone ?? "");
          setDocumentType(profile?.documentType ?? "");
          setDocumentNumber(profile?.documentNumber ?? "");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Postulación</DialogTitle>
        </DialogHeader>
        {vacancy ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">{vacancy.title}</span>
              <span className="text-muted-foreground"> · {vacancy.areaName}</span>
            </p>
            <p className="text-muted-foreground">
              El formulario se abre aquí. Nombres, apellidos e identificación se
              toman de tu perfil y no se pueden cambiar.
            </p>
            <LockedField
              label="Nombres"
              value={profile?.firstName ?? "—"}
            />
            <LockedField
              label="Apellidos"
              value={profile?.lastName ?? "—"}
            />
            <LockedField
              label="Identificación"
              value={formatIdentification(profile)}
            />
            {needsPhone ? (
              <div className="space-y-2">
                <Label htmlFor="home-apply-phone">Teléfono *</Label>
                <Input
                  id="home-apply-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  minLength={5}
                  required
                />
              </div>
            ) : null}
            {needsDocument ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FormSelect
                    id="home-apply-doc-type"
                    label="Tipo de documento"
                    value={documentType}
                    onChange={setDocumentType}
                    options={CANDIDATE_DOCUMENT_TYPES.map((item) => ({
                      value: item.code,
                      label: item.label,
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="home-apply-doc-number">Número *</Label>
                  <Input
                    id="home-apply-doc-number"
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    minLength={3}
                    required
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={
              applyMutation.isPending ||
              !profile ||
              (needsPhone && phone.trim().length < 5) ||
              (needsDocument &&
                (documentType.length === 0 || documentNumber.trim().length < 3))
            }
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? "Enviando…" : "Enviar postulación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSection({ profile }: { profile: HomeProfile | null }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateHomeProfileInput>({});

  const startEdit = () => {
    if (!profile) return;
    setForm({
      email: profile.email,
      phone: profile.phone ?? "",
      country: profile.country ?? "",
      state: profile.state ?? "",
      city: profile.city ?? "",
      maritalStatus: profile.maritalStatus ?? "",
      childrenCount: profile.childrenCount,
      housingType: profile.housingType ?? "",
      emergencyContactName: profile.emergencyContactName ?? "",
      emergencyContactPhone: profile.emergencyContactPhone ?? "",
    });
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => homeApi.updateProfile(form),
    onSuccess: async () => {
      notifySuccess("Perfil actualizado");
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
      setEditing(false);
    },
    onError: (error) => {
      notifyError(error, "No se pudo guardar el perfil.");
    },
  });

  if (!profile) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Información de perfil</h2>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Tu usuario aún no está vinculado a un colaborador. Pide a un
            administrador que asocie tu cuenta.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Información de perfil</h2>
          <p className="text-sm text-muted-foreground">
            Puedes actualizar contacto y datos personales. Nombres, apellidos,
            identificación y fecha de nacimiento los gestiona la compañía.
          </p>
        </div>
        {!editing ? (
          <Button type="button" variant="outline" onClick={startEdit}>
            Editar
          </Button>
        ) : null}
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <LockedField label="Nombres" value={profile.firstName} />
          <LockedField label="Apellidos" value={profile.lastName} />
          <LockedField
            label="Identificación"
            value={formatIdentification(profile)}
          />
          <LockedField
            label="Fecha de nacimiento"
            value={profile.birthDate ?? "—"}
          />
          {editing ? (
            <>
              <EditableField
                id="home-email"
                label="Email"
                value={form.email ?? ""}
                onChange={(email) => setForm((current) => ({ ...current, email }))}
              />
              <EditableField
                id="home-phone"
                label="Teléfono"
                value={form.phone ?? ""}
                onChange={(phone) => setForm((current) => ({ ...current, phone }))}
              />
              <EditableField
                id="home-city"
                label="Ciudad"
                value={form.city ?? ""}
                onChange={(city) => setForm((current) => ({ ...current, city }))}
              />
              <EditableField
                id="home-marital"
                label="Estado civil"
                value={form.maritalStatus ?? ""}
                onChange={(maritalStatus) =>
                  setForm((current) => ({ ...current, maritalStatus }))
                }
              />
              <EditableField
                id="home-emergency-name"
                label="Contacto de emergencia"
                value={form.emergencyContactName ?? ""}
                onChange={(emergencyContactName) =>
                  setForm((current) => ({ ...current, emergencyContactName }))
                }
              />
              <EditableField
                id="home-emergency-phone"
                label="Teléfono de emergencia"
                value={form.emergencyContactPhone ?? ""}
                onChange={(emergencyContactPhone) =>
                  setForm((current) => ({ ...current, emergencyContactPhone }))
                }
              />
              <div className="sm:col-span-2 flex gap-2">
                <Button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <>
              <LockedField label="Email" value={profile.email} />
              <LockedField label="Teléfono" value={profile.phone ?? "—"} />
              <LockedField label="Cargo" value={profile.positionName ?? "—"} />
              <LockedField label="Área" value={profile.areaName ?? "—"} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ApprovalsSection({ items }: { items: HomePendingApproval[] }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<HomePendingApproval | null>(null);
  const [comment, setComment] = useState("");

  const approveMutation = useMutation({
    mutationFn: (id: string) => atsApi.approveVacancyRequest(id, {}),
    onSuccess: async () => {
      notifySuccess("Solicitud aprobada");
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.vacancyRequests(companyId),
      });
    },
    onError: (error) => {
      notifyError(error, "No se pudo aprobar.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      atsApi.rejectVacancyRequest(rejecting!.id, { comment: comment.trim() }),
    onSuccess: async () => {
      notifySuccess("Solicitud rechazada");
      setRejecting(null);
      setComment("");
      await queryClient.invalidateQueries({ queryKey: homeKeys.feed(companyId) });
    },
    onError: (error) => {
      notifyError(error, "No se pudo rechazar.");
    },
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Aprobaciones pendientes</h2>
        <p className="text-sm text-muted-foreground">
          Te eligieron como aprobador de estos procesos. Puedes aceptar o
          rechazar aquí.
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>Solicita {item.requesterName}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(item.id)}
              >
                Aceptar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setRejecting(item);
                  setComment("");
                }}
              >
                Rechazar
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link href={`/ats/vacancy-requests/${item.id}`}>Ver detalle</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="home-reject-comment">Comentario *</Label>
            <Textarea
              id="home-reject-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending || comment.trim().length === 0}
              onClick={() => rejectMutation.mutate()}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EvaluationsSection({
  items,
}: {
  items: Array<{
    id: string;
    candidateName: string;
    vacancyTitle: string;
    status: string;
  }>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Candidatos por evaluar</h2>
        <p className="text-sm text-muted-foreground">
          Te asignaron como evaluador. Entra al formulario de la entrevista.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{item.candidateName}</CardTitle>
              <CardDescription>{item.vacancyTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" size="sm" asChild>
                <Link href={`/ats/interviews/${item.id}`}>
                  Ir al formulario de evaluación
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function AssignedVacanciesSection({
  items,
}: {
  items: HomeAssignedVacancy[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Procesos asignados</h2>
        <p className="text-sm text-muted-foreground">
          Solo ves los procesos de selección que te asignaron.
        </p>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Aún no tienes procesos de selección asignados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.areaName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge variant={vacancyStatusVariant(item.status as VacancyStatus)}>
                  {VACANCY_STATUS_LABELS[item.status as VacancyStatus] ??
                    item.status}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {item.filledCount}/{item.headcount} plazas ·{" "}
                  {item.applicationCount} postulaciones
                </p>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/ats/vacancies/${item.id}`}>Ver proceso</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function AssignedMetricsSection({ metrics }: { metrics: HomeAssignedMetrics }) {
  const cards = [
    { label: "Vacantes asignadas", value: metrics.vacancyCount },
    { label: "Abiertos", value: metrics.openCount },
    { label: "Postulaciones", value: metrics.applicationCount },
    { label: "En proceso", value: metrics.activeApplicationCount },
    { label: "Contratados", value: metrics.hiredCount },
    { label: "Entrevistas pendientes", value: metrics.pendingInterviewCount },
    {
      label: "Plazas cubiertas",
      value: `${metrics.filledHeadcount}/${metrics.requestedHeadcount}`,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Métricas de tus procesos</h2>
        <p className="text-sm text-muted-foreground">
          Cifras únicamente de las vacantes asignadas a ti.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((item) => (
          <Card key={item.label}>
            <CardHeader className="space-y-1">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {item.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

function AllProcessesSection() {
  const companyId = useCompanyId();
  const listQuery = useQuery({
    queryKey: atsKeys.vacancies(companyId, { page: 1, limit: 20 }),
    queryFn: () => atsApi.listVacancies({ page: 1, limit: 20 }),
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Todos los procesos de selección</h2>
          <p className="text-sm text-muted-foreground">
            Vista de los procesos existentes en la compañía, en cualquier estado.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/ats/vacancies">Ver todos</Link>
        </Button>
      </div>
      {listQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : listQuery.isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {getErrorMessage(
              listQuery.error,
              "No se pudieron cargar los procesos.",
            )}
          </CardContent>
        </Card>
      ) : (listQuery.data?.items.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No hay procesos de selección en la compañía.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {listQuery.data!.items.map((vacancy) => (
            <ProcessCard key={vacancy.id} vacancy={vacancy} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProcessCard({ vacancy }: { vacancy: Vacancy }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{vacancy.title}</CardTitle>
        <CardDescription>{vacancy.area?.name ?? "—"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant={vacancyStatusVariant(vacancy.status)}>
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {vacancy.filledCount}/{vacancy.headcount} plazas
          {vacancy.assignedRecruiter
            ? ` · ${formatEmployeeName(vacancy.assignedRecruiter)}`
            : ""}
        </p>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href={`/ats/vacancies/${vacancy.id}`}>Ver proceso</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function EditableField({
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function formatIdentification(profile: HomeProfile | null | undefined): string {
  if (!profile?.documentNumber) return "Sin registrar";
  const type = profile.documentType
    ? candidateDocumentTypeLabel(profile.documentType) ?? profile.documentType
    : null;
  return type ? `${type} ${profile.documentNumber}` : profile.documentNumber;
}
