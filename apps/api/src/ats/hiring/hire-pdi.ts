export type InterviewPdiSource = {
  strengths?: string | null;
  improvements?: string | null;
  interviewerLabel?: string | null;
  completedAt?: string | Date | null;
};

export type HirePdiDraft = {
  name: string;
  strengths: string | null;
  improvements: string | null;
  observations: string | null;
  sourceCount: number;
};

export function buildHirePdiDraft(input: {
  candidateFirstName: string;
  candidateLastName: string;
  vacancyTitle: string;
  interviews: InterviewPdiSource[];
}): HirePdiDraft {
  const fullName =
    `${input.candidateFirstName} ${input.candidateLastName}`.trim() ||
    'nuevo colaborador';
  const vacancy = input.vacancyTitle.trim() || 'la vacante';
  const strengthBlocks: string[] = [];
  const improvementBlocks: string[] = [];

  for (const interview of input.interviews) {
    const label = interview.interviewerLabel?.trim() || 'Evaluador';
    const strengths = interview.strengths?.trim();
    const improvements = interview.improvements?.trim();
    if (strengths) {
      strengthBlocks.push(`• ${label}\n${strengths}`);
    }
    if (improvements) {
      improvementBlocks.push(`• ${label}\n${improvements}`);
    }
  }

  const sourceCount = strengthBlocks.length + improvementBlocks.length;
  return {
    name: `PDI onboarding — ${fullName} (${vacancy})`,
    strengths: strengthBlocks.length ? strengthBlocks.join('\n\n') : null,
    improvements: improvementBlocks.length
      ? improvementBlocks.join('\n\n')
      : null,
    observations: sourceCount
      ? `Generado automáticamente desde ${sourceCount} aporte(s) de entrevistas del proceso de selección.`
      : 'Sin fortalezas ni oportunidades registradas en entrevistas; completa el PDI en Performance.',
    sourceCount,
  };
}

export function renderHirePdiText(input: {
  draft: HirePdiDraft;
  candidateName: string;
  vacancyTitle: string;
  companyName?: string | null;
}): string {
  const lines = [
    input.draft.name,
    '',
    `Candidato: ${input.candidateName}`,
    `Vacante: ${input.vacancyTitle}`,
    ...(input.companyName ? [`Compañía: ${input.companyName}`] : []),
    '',
    'Fortalezas',
    input.draft.strengths || '(Sin registrar)',
    '',
    'Oportunidades de mejora',
    input.draft.improvements || '(Sin registrar)',
    '',
    'Observaciones',
    input.draft.observations || '',
    '',
  ];
  return lines.join('\n');
}
