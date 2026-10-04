export type PdiSuggestion = {
  name: string;
  competencyId: string | null;
  actions70: string;
  actions20: string;
  actions10: string;
  observations: string;
};

export type PdiPromptInput = {
  employeeName: string;
  positionName: string | null;
  competencies: Array<{ id: string; name: string }>;
  individualGoals: Array<{ title: string; description?: string | null }>;
  cascadedGoals: Array<{ title: string; description?: string | null }>;
};

export const PDI_SYSTEM_PROMPT = `Eres un experto en Desarrollo Organizacional.
Analiza el cargo, las competencias disponibles y los objetivos del colaborador, y genera un Plan de Desarrollo Individual (PDI) basado estrictamente en el modelo 70-20-10.
No inventes experiencia, certificaciones ni resultados que no estén en el texto.
competencyId debe ser uno de los id de la lista. Si ninguna aplica, usa null.
Debes devolver ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "nombre_plan": "Nombre corto del plan.",
  "competencyId": "uuid de la lista o null",
  "resumen_analitico": "Un párrafo resumiendo el foco del plan.",
  "accion_70_experiencia": "Al menos una acción práctica en el puesto de trabajo.",
  "accion_20_exposicion": "Al menos una acción de aprendizaje social, mentoría o feedback.",
  "accion_10_educacion": "Al menos una acción de formación formal o teórica."
}`;

function lines(
  goals: Array<{ title: string; description?: string | null }>,
): string {
  const filled = goals
    .map((goal) => ({
      title: goal.title.trim(),
      description: goal.description?.trim() || '',
    }))
    .filter((goal) => goal.title);
  if (filled.length === 0) return '- Sin objetivos cargados.';
  return filled
    .map((goal) =>
      goal.description
        ? `- ${goal.title}: ${goal.description}`
        : `- ${goal.title}`,
    )
    .join('\n');
}

export function buildPdiUserPrompt(input: PdiPromptInput): string {
  const competencies =
    input.competencies.length === 0
      ? '- Ninguna.'
      : input.competencies
          .map((item) => `- ${item.id}: ${item.name}`)
          .join('\n');
  return `Colaborador: ${input.employeeName}
Cargo: ${input.positionName?.trim() || 'No indicado'}

COMPETENCIAS DISPONIBLES:
${competencies}

OBJETIVOS INDIVIDUALES:
${lines(input.individualGoals)}

ACCIONES CASCADEADAS:
${lines(input.cascadedGoals)}`;
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function parsePdiSuggestion(
  raw: string,
  competencyIds: Set<string>,
): PdiSuggestion {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('La respuesta de Gemini no es un JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('La respuesta de Gemini no es un JSON válido.');
  }
  const row = parsed as Record<string, unknown>;
  const competencyId =
    typeof row.competencyId === 'string' && competencyIds.has(row.competencyId)
      ? row.competencyId
      : null;
  return {
    name: clip(row.nombre_plan, 300),
    competencyId,
    actions70: clip(row.accion_70_experiencia, 4000),
    actions20: clip(row.accion_20_exposicion, 4000),
    actions10: clip(row.accion_10_educacion, 4000),
    observations: clip(row.resumen_analitico, 4000),
  };
}
