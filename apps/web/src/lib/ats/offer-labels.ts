import type {
  JobOfferStatus,
  OfferEmploymentType,
  SalaryPeriod,
} from "@/types/offers";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

export const OFFER_STATUS_LABELS: Record<JobOfferStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  WITHDRAWN: "Retirada",
};

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
  HOURLY: "Por hora",
};

export const OFFER_EMPLOYMENT_TYPE_LABELS: Record<OfferEmploymentType, string> =
  {
    FULL_TIME: "Tiempo completo",
    PART_TIME: "Medio tiempo",
    FIXED_TERM: "Término fijo",
    CONTRACTOR: "Prestación de servicios",
  };

export function offerStatusVariant(status: JobOfferStatus): BadgeVariant {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "SENT":
      return "warning";
    case "DRAFT":
      return "secondary";
    case "REJECTED":
    case "EXPIRED":
    case "WITHDRAWN":
      return "destructive";
    default:
      return "outline";
  }
}

/** Format money with ISO currency via Intl — never hardcode "$". */
export function formatMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale = "es-CO",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "—";
  const code = (currency ?? "COP").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(locale)}`;
  }
}

export function isOfferExpiredClient(
  status: JobOfferStatus,
  expiresAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (status === "EXPIRED") return true;
  if (status !== "SENT" || !expiresAt) return false;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() <= now.getTime();
}
