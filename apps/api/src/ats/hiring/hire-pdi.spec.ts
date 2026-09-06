import { buildHirePdiDraft, renderHirePdiText } from './hire-pdi';

describe('buildHirePdiDraft', () => {
  it('aggregates strengths and improvements from interviews', () => {
    const draft = buildHirePdiDraft({
      candidateFirstName: 'Ana',
      candidateLastName: 'Pérez',
      vacancyTitle: 'Analista',
      interviews: [
        {
          strengths: 'Comunicación clara',
          improvements: 'Profundizar Excel',
          interviewerLabel: 'Líder',
        },
        {
          strengths: 'Orientación a resultados',
          improvements: null,
          interviewerLabel: 'HR',
        },
      ],
    });
    expect(draft.name).toContain('Ana Pérez');
    expect(draft.strengths).toContain('Líder');
    expect(draft.strengths).toContain('Comunicación clara');
    expect(draft.strengths).toContain('HR');
    expect(draft.improvements).toContain('Profundizar Excel');
    expect(draft.sourceCount).toBe(3);
  });

  it('handles empty interviews', () => {
    const draft = buildHirePdiDraft({
      candidateFirstName: 'Luis',
      candidateLastName: 'Gómez',
      vacancyTitle: 'Dev',
      interviews: [],
    });
    expect(draft.strengths).toBeNull();
    expect(draft.improvements).toBeNull();
    expect(draft.sourceCount).toBe(0);
    expect(draft.observations).toMatch(/Sin fortalezas/);
  });
});

describe('renderHirePdiText', () => {
  it('renders a plain-text document', () => {
    const draft = buildHirePdiDraft({
      candidateFirstName: 'Ana',
      candidateLastName: 'Pérez',
      vacancyTitle: 'Analista',
      interviews: [{ strengths: 'A', improvements: 'B', interviewerLabel: 'X' }],
    });
    const text = renderHirePdiText({
      draft,
      candidateName: 'Ana Pérez',
      vacancyTitle: 'Analista',
      companyName: 'Acme',
    });
    expect(text).toContain('Fortalezas');
    expect(text).toContain('Acme');
    expect(text).toContain('A');
  });
});
