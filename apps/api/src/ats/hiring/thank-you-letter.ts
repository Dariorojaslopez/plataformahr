export const DEFAULT_THANK_YOU_SUBJECT =
  'Gracias por participar en nuestro proceso de selección';

export const DEFAULT_THANK_YOU_BODY = `Hola {{firstName}},

Agradecemos tu interés y el tiempo dedicado a nuestro proceso de selección para {{vacancyTitle}}.

En esta ocasión avanzamos con otro perfil, pero conservaremos tus datos en nuestro pool de candidatos para futuras oportunidades.

Saludos cordiales,
Equipo de Talento Humano`;

export function renderThankYouLetter(input: {
  subject?: string | null;
  body?: string | null;
  firstName: string;
  lastName: string;
  vacancyTitle: string;
  companyName: string;
}): { subject: string; body: string } {
  const values: Record<string, string> = {
    firstName: input.firstName.trim() || 'candidato/a',
    lastName: input.lastName.trim(),
    fullName: `${input.firstName} ${input.lastName}`.trim(),
    vacancyTitle: input.vacancyTitle.trim() || 'la vacante',
    companyName: input.companyName.trim() || 'la compañía',
  };
  const subject = applyTokens(
    input.subject?.trim() || DEFAULT_THANK_YOU_SUBJECT,
    values,
  );
  const body = applyTokens(
    input.body?.trim() || DEFAULT_THANK_YOU_BODY,
    values,
  );
  return { subject, body };
}

function applyTokens(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    return values[key] ?? '';
  });
}
