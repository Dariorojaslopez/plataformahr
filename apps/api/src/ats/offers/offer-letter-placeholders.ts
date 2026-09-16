import {
  buildOfferLetterPlaceholderValues,
  fillOfferLetterPlaceholders,
  type OfferLetterPlaceholderValues,
} from '@talento/shared';
import {
  OfferEmploymentType,
  SalaryPeriod,
  type Prisma,
} from '@prisma/client';

const SALARY_PERIOD_LABEL: Record<SalaryPeriod, string> = {
  [SalaryPeriod.MONTHLY]: 'Mensual',
  [SalaryPeriod.ANNUAL]: 'Anual',
  [SalaryPeriod.HOURLY]: 'Por hora',
};

const EMPLOYMENT_TYPE_LABEL: Record<OfferEmploymentType, string> = {
  [OfferEmploymentType.FULL_TIME]: 'Tiempo completo',
  [OfferEmploymentType.PART_TIME]: 'Tiempo parcial',
  [OfferEmploymentType.FIXED_TERM]: 'Término fijo',
  [OfferEmploymentType.CONTRACTOR]: 'Prestación de servicios',
};

function formatDateEs(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatSalary(
  amount: Prisma.Decimal | { toString(): string },
  currency: string,
): string {
  const number = Number(amount.toString());
  if (!Number.isFinite(number)) return amount.toString();
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0,
    }).format(number);
  } catch {
    return `${amount.toString()} ${currency}`.trim();
  }
}

export function offerLetterPlaceholderValues(input: {
  candidateName: string;
  positionTitle: string;
  salaryAmount: Prisma.Decimal | { toString(): string };
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  employmentType: OfferEmploymentType;
  startDate?: Date | null;
  notes?: string | null;
  city?: string | null;
  signerName?: string | null;
  documentDate?: Date;
}): OfferLetterPlaceholderValues {
  return buildOfferLetterPlaceholderValues({
    candidateName: input.candidateName,
    positionTitle: input.positionTitle,
    documentDate: formatDateEs(input.documentDate ?? new Date()),
    salary: formatSalary(input.salaryAmount, input.salaryCurrency),
    paymentForm: SALARY_PERIOD_LABEL[input.salaryPeriod],
    contractType: EMPLOYMENT_TYPE_LABEL[input.employmentType],
    startDate: formatDateEs(input.startDate ?? null),
    benefits: input.notes,
    city: input.city,
    signerName: input.signerName,
  });
}

export function fillOfferLetterText(
  text: string,
  values: OfferLetterPlaceholderValues,
): string {
  return fillOfferLetterPlaceholders(text, values);
}

export function fillOfferLetterBuffer(
  buffer: Buffer,
  values: OfferLetterPlaceholderValues,
): Buffer {
  const original = buffer.toString('binary');
  const filled = fillOfferLetterPlaceholders(original, values);
  if (filled === original) return buffer;
  return Buffer.from(filled, 'binary');
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function publicWebOrigin(): string {
  const raw = process.env.CORS_ORIGINS?.split(',')[0]?.trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'http://localhost:3000';
}
