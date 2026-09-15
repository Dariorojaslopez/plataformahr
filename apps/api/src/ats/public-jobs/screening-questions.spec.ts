import { BadRequestException } from '@nestjs/common';
import { VacancyScreeningQuestionType } from '@prisma/client';
import {
  evaluateScreeningAnswers,
  normalizeScreeningQuestionInput,
} from './screening-questions';

const FAIL = 'No cumples el mínimo de respuestas correctas para esta vacante.';

describe('normalizeScreeningQuestionInput', () => {
  it('keeps yes/no questions as boolean', () => {
    const result = normalizeScreeningQuestionInput({
      prompt: ' ¿Habla inglés? ',
      correctAnswer: false,
    });
    expect(result).toEqual({
      prompt: '¿Habla inglés?',
      type: VacancyScreeningQuestionType.YES_NO,
      correctAnswer: false,
      options: null,
      correctOptionIds: null,
    });
  });

  it('requires a correct option for single choice', () => {
    expect(() =>
      normalizeScreeningQuestionInput({
        prompt: 'Nivel de inglés',
        type: VacancyScreeningQuestionType.SINGLE_CHOICE,
        options: [
          { id: '11111111-1111-4111-8111-111111111111', label: 'A1' },
          { id: '22222222-2222-4222-8222-222222222222', label: 'B2' },
        ],
        correctOptionIds: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('expands all-of-the-above as the full correct set for multiple choice', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const all = '33333333-3333-4333-8333-333333333333';
    const result = normalizeScreeningQuestionInput({
      prompt: 'Requisitos',
      type: VacancyScreeningQuestionType.MULTIPLE_CHOICE,
      options: [
        { id: a, label: 'Disponibilidad' },
        { id: b, label: 'Viajes' },
        { id: all, label: 'Todas las anteriores', isAllOfTheAbove: true },
      ],
      correctOptionIds: [all],
    });
    expect(result.correctOptionIds).toEqual([a, b]);
  });
});

describe('evaluateScreeningAnswers', () => {
  const yesNo = {
    id: 'q-yes',
    prompt: '¿Tiene experiencia?',
    type: VacancyScreeningQuestionType.YES_NO,
    correctAnswer: true,
    options: null,
    correctOptionIds: null,
    sortOrder: 1,
  };

  it('scores true/false like yes/no with different labels only', () => {
    const result = evaluateScreeningAnswers(
      [
        {
          ...yesNo,
          id: 'q-tf',
          type: VacancyScreeningQuestionType.TRUE_FALSE,
          prompt: 'El cargo es remoto',
          correctAnswer: false,
        },
      ],
      1,
      [{ questionId: 'q-tf', answer: false }],
      FAIL,
    );
    expect(result.correctCount).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('accepts a single choice answer by option id', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const result = evaluateScreeningAnswers(
      [
        {
          id: 'q-single',
          prompt: 'Ciudad',
          type: VacancyScreeningQuestionType.SINGLE_CHOICE,
          correctAnswer: null,
          options: [
            { id: a, label: 'Bogotá' },
            { id: b, label: 'Medellín' },
          ],
          correctOptionIds: [b],
          sortOrder: 1,
        },
      ],
      1,
      [{ questionId: 'q-single', selectedOptionIds: [b] }],
      FAIL,
    );
    expect(result.answers[0]?.isCorrect).toBe(true);
  });

  it('treats all-of-the-above as selecting every previous option', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const all = '33333333-3333-4333-8333-333333333333';
    const question = {
      id: 'q-multi',
      prompt: 'Beneficios',
      type: VacancyScreeningQuestionType.MULTIPLE_CHOICE,
      correctAnswer: null,
      options: [
        { id: a, label: 'EPS' },
        { id: b, label: 'Caja' },
        { id: all, label: 'Todas las anteriores', isAllOfTheAbove: true },
      ],
      correctOptionIds: [a, b],
      sortOrder: 1,
    };
    const viaAll = evaluateScreeningAnswers(
      [question],
      1,
      [{ questionId: 'q-multi', selectedOptionIds: [all] }],
      FAIL,
    );
    const viaEach = evaluateScreeningAnswers(
      [question],
      1,
      [{ questionId: 'q-multi', selectedOptionIds: [a, b] }],
      FAIL,
    );
    expect(viaAll.answers[0]?.isCorrect).toBe(true);
    expect(viaEach.answers[0]?.isCorrect).toBe(true);
  });

  it('rejects when the minimum correct answers is not reached', () => {
    expect(() =>
      evaluateScreeningAnswers(
        [yesNo],
        1,
        [{ questionId: 'q-yes', answer: false }],
        FAIL,
      ),
    ).toThrow(FAIL);
  });
});
