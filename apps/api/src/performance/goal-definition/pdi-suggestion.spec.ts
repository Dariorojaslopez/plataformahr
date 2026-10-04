import { buildPdiUserPrompt, parsePdiSuggestion } from './pdi-suggestion';

describe('pdi suggestion prompt', () => {
  it('includes the person, the job, competencies and goals', () => {
    const prompt = buildPdiUserPrompt({
      employeeName: 'Clara Pasos',
      positionName: 'Reclutador',
      competencies: [{ id: 'comp-1', name: 'Comunicación' }],
      individualGoals: [{ title: 'Aumentar el cierre', description: 'Más ofertas' }],
      cascadedGoals: [],
    });

    expect(prompt).toContain('Clara Pasos');
    expect(prompt).toContain('Reclutador');
    expect(prompt).toContain('comp-1: Comunicación');
    expect(prompt).toContain('Aumentar el cierre: Más ofertas');
    expect(prompt).toContain('Sin objetivos cargados.');
  });

  it('keeps only a competency id from the list', () => {
    const suggestion = parsePdiSuggestion(
      JSON.stringify({
        nombre_plan: 'Plan de comunicación',
        competencyId: 'otro',
        resumen_analitico: 'Foco en entrevistas.',
        accion_70_experiencia: 'Conducir entrevistas.',
        accion_20_exposicion: 'Observar a un par.',
        accion_10_educacion: 'Curso de entrevista.',
      }),
      new Set(['comp-1']),
    );

    expect(suggestion.competencyId).toBeNull();
    expect(suggestion.name).toBe('Plan de comunicación');
    expect(suggestion.actions70).toBe('Conducir entrevistas.');
    expect(suggestion.observations).toBe('Foco en entrevistas.');
  });
});
