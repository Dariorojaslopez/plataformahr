import {
  buildCandidateFitText,
  computeProfileFit,
  tokenize,
} from './profile-fit';

describe('computeProfileFit', () => {
  it('returns green when required overlap and screening are strong', () => {
    const result = computeProfileFit({
      requiredText: 'React TypeScript NestJS 3 años desarrollo frontend',
      jobText: 'Equipo producto features colaboración ágil',
      candidateText:
        'Desarrolladora React TypeScript NestJS con foco en frontend y producto',
      screeningPassed: true,
      screeningCorrectCount: 3,
      screeningTotal: 3,
    });
    expect(result.level).toBe('green');
    expect(result.summary).toContain('Ajuste adecuado');
    expect(result.summary).toContain('requisitos');
  });

  it('weights required profile higher than generic JD text', () => {
    const strongRequired = computeProfileFit({
      requiredText: 'React TypeScript PostgreSQL',
      jobText: 'cultura equipo beneficios oficina',
      candidateText: 'React TypeScript PostgreSQL backend APIs',
      screeningPassed: true,
      screeningCorrectCount: 2,
      screeningTotal: 2,
    });
    const weakRequired = computeProfileFit({
      requiredText: 'SAP FI CO finanzas contabilidad',
      jobText: 'cultura equipo beneficios oficina',
      candidateText: 'React TypeScript PostgreSQL backend APIs',
      screeningPassed: true,
      screeningCorrectCount: 2,
      screeningTotal: 2,
    });
    expect(strongRequired.level).toBe('green');
    expect(['yellow', 'red']).toContain(weakRequired.level);
  });

  it('returns red when screening failed even with keyword overlap', () => {
    const result = computeProfileFit({
      requiredText: 'React TypeScript',
      jobText: 'React TypeScript',
      candidateText: 'React TypeScript',
      screeningPassed: false,
      screeningCorrectCount: 0,
      screeningTotal: 2,
    });
    expect(result.level).toBe('red');
    expect(result.summary).toContain('screening');
  });

  it('treats js/ts aliases as matches', () => {
    const result = computeProfileFit({
      requiredText: 'JavaScript TypeScript',
      jobText: '',
      candidateText: 'Experiencia con JS y TS en producto',
      screeningPassed: true,
      screeningCorrectCount: 1,
      screeningTotal: 1,
    });
    expect(result.level).toBe('green');
  });

  it('tokenizes ignoring accents, stopwords and short fluff', () => {
    const tokens = tokenize(
      'Experiencia en educación y AI para el cargo requerido',
    );
    expect(tokens.has('educacion')).toBe(true);
    expect(tokens.has('experiencia')).toBe(true);
    expect(tokens.has('requerido')).toBe(false);
    expect(tokens.has('para')).toBe(false);
    expect(tokens.has('ai')).toBe(true);
  });

  it('expands education level enums into Spanish words', () => {
    const tokens = tokenize('PROFESSIONAL Ingeniería de Sistemas');
    expect(tokens.has('profesional')).toBe(true);
    expect(tokens.has('ingenieria')).toBe(true);
  });

  it('builds candidate text from profile parts', () => {
    expect(
      buildCandidateFitText(['Perfil', null, '  Empresa  ', undefined]),
    ).toBe('Perfil\n  Empresa  ');
  });

  it('returns gray when there is almost no signal', () => {
    expect(
      computeProfileFit({
        jobText: '',
        requiredText: '',
        candidateText: '',
        screeningPassed: true,
        screeningCorrectCount: 0,
        screeningTotal: 0,
      }).level,
    ).toBe('gray');
  });
});
