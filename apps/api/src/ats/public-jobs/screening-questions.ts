import { BadRequestException } from '@nestjs/common';
import { Prisma, VacancyScreeningQuestionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const ALL_OF_THE_ABOVE_LABEL = 'Todas las anteriores';
export const CHOICE_OPTION_MIN = 2;
export const CHOICE_OPTION_MAX = 8;

export type ScreeningOption = {
  id: string;
  label: string;
  isAllOfTheAbove?: boolean;
};

export type ScreeningQuestionRecord = {
  id: string;
  prompt: string;
  type: VacancyScreeningQuestionType;
  correctAnswer: boolean | null;
  options: Prisma.JsonValue | ScreeningOption[] | null;
  correctOptionIds: Prisma.JsonValue | string[] | null;
  sortOrder: number;
};

export type ScreeningAnswerInput = {
  questionId: string;
  answer?: boolean | null;
  selectedOptionIds?: string[];
};

export type ScoredScreeningAnswer = {
  questionId: string;
  questionType: VacancyScreeningQuestionType;
  questionPrompt: string;
  optionsSnapshot: ScreeningOption[] | null;
  correctAnswer: boolean | null;
  answer: boolean | null;
  correctOptionIds: string[] | null;
  selectedOptionIds: string[] | null;
  isCorrect: boolean;
  sortOrder: number;
};

export type NormalizedScreeningQuestion = {
  prompt: string;
  type: VacancyScreeningQuestionType;
  correctAnswer: boolean | null;
  options: ScreeningOption[] | null;
  correctOptionIds: string[] | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBooleanScreeningType(
  type: VacancyScreeningQuestionType,
): type is
  | typeof VacancyScreeningQuestionType.YES_NO
  | typeof VacancyScreeningQuestionType.TRUE_FALSE {
  return (
    type === VacancyScreeningQuestionType.YES_NO ||
    type === VacancyScreeningQuestionType.TRUE_FALSE
  );
}

export function isChoiceScreeningType(
  type: VacancyScreeningQuestionType,
): type is
  | typeof VacancyScreeningQuestionType.SINGLE_CHOICE
  | typeof VacancyScreeningQuestionType.MULTIPLE_CHOICE {
  return (
    type === VacancyScreeningQuestionType.SINGLE_CHOICE ||
    type === VacancyScreeningQuestionType.MULTIPLE_CHOICE
  );
}

export function parseScreeningOptions(
  value: Prisma.JsonValue | ScreeningOption[] | null | undefined,
): ScreeningOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!id || !label) return [];
    return [
      {
        id,
        label,
        isAllOfTheAbove: record.isAllOfTheAbove === true,
      },
    ];
  });
}

export function parseStringIds(
  value: Prisma.JsonValue | string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) ids.push(item);
  }
  return [...new Set(ids)];
}

export function toPublicScreeningOptions(options: ScreeningOption[]) {
  return options.map((option) => ({
    id: option.id,
    label: option.label,
    isAllOfTheAbove: option.isAllOfTheAbove === true,
  }));
}

export function expandSelectedOptionIds(
  selectedIds: string[],
  options: ScreeningOption[],
  type: VacancyScreeningQuestionType,
): string[] {
  if (type !== VacancyScreeningQuestionType.MULTIPLE_CHOICE) {
    return [...new Set(selectedIds)];
  }
  const allOfTheAbove = options.find((option) => option.isAllOfTheAbove);
  if (!allOfTheAbove || !selectedIds.includes(allOfTheAbove.id)) {
    return [
      ...new Set(
        selectedIds.filter((id) =>
          options.some((option) => option.id === id && !option.isAllOfTheAbove),
        ),
      ),
    ];
  }
  return options
    .filter((option) => !option.isAllOfTheAbove)
    .map((option) => option.id);
}

function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

export function normalizeScreeningQuestionInput(input: {
  prompt: string;
  type?: VacancyScreeningQuestionType;
  correctAnswer?: boolean;
  options?: Array<{ id?: string; label: string; isAllOfTheAbove?: boolean }>;
  correctOptionIds?: string[];
}): NormalizedScreeningQuestion {
  const type = input.type ?? VacancyScreeningQuestionType.YES_NO;
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new BadRequestException('El enunciado de la pregunta es obligatorio.');
  }

  if (isBooleanScreeningType(type)) {
    if (typeof input.correctAnswer !== 'boolean') {
      throw new BadRequestException(
        'Las preguntas Sí/No y verdadero/falso requieren una respuesta correcta.',
      );
    }
    return {
      prompt,
      type,
      correctAnswer: input.correctAnswer,
      options: null,
      correctOptionIds: null,
    };
  }

  if (!isChoiceScreeningType(type)) {
    throw new BadRequestException('Tipo de pregunta de screening no válido.');
  }

  const seenIds = new Set<string>();
  const idMap = new Map<string, string>();
  const options: ScreeningOption[] = [];
  for (const raw of input.options ?? []) {
    const label = raw.label.trim() || (raw.isAllOfTheAbove ? ALL_OF_THE_ABOVE_LABEL : '');
    if (!label) continue;
    const incomingId = raw.id?.trim() ?? '';
    const id = incomingId && UUID_RE.test(incomingId) ? incomingId : randomUUID();
    if (incomingId) idMap.set(incomingId, id);
    if (seenIds.has(id)) {
      throw new BadRequestException('Las opciones no pueden repetir el mismo identificador.');
    }
    seenIds.add(id);
    options.push({
      id,
      label: raw.isAllOfTheAbove ? label || ALL_OF_THE_ABOVE_LABEL : label,
      isAllOfTheAbove: raw.isAllOfTheAbove === true,
    });
  }

  if (options.length < CHOICE_OPTION_MIN) {
    throw new BadRequestException(
      `Las preguntas de opción múltiple necesitan al menos ${CHOICE_OPTION_MIN} alternativas.`,
    );
  }
  if (options.length > CHOICE_OPTION_MAX) {
    throw new BadRequestException(
      `Las preguntas de opción múltiple admiten máximo ${CHOICE_OPTION_MAX} alternativas.`,
    );
  }

  const allOfTheAboveCount = options.filter((option) => option.isAllOfTheAbove).length;
  if (allOfTheAboveCount > 1) {
    throw new BadRequestException(
      'Solo puede haber una opción de “todas las anteriores”.',
    );
  }

  const optionIds = new Set(options.map((option) => option.id));
  const incomingCorrect = parseStringIds(input.correctOptionIds)
    .map((id) => idMap.get(id) ?? id)
    .filter((id) => optionIds.has(id));
  const correctOptionIds =
    type === VacancyScreeningQuestionType.MULTIPLE_CHOICE
      ? expandSelectedOptionIds(incomingCorrect, options, type)
      : incomingCorrect.slice(0, 1);

  if (type === VacancyScreeningQuestionType.SINGLE_CHOICE) {
    if (correctOptionIds.length !== 1) {
      throw new BadRequestException(
        'Las preguntas de única respuesta deben marcar una alternativa correcta.',
      );
    }
  } else if (correctOptionIds.length < 1) {
    throw new BadRequestException(
      'Las preguntas de múltiples respuestas deben marcar al menos una alternativa correcta.',
    );
  }

  return {
    prompt,
    type,
    correctAnswer: null,
    options,
    correctOptionIds,
  };
}

export function evaluateScreeningAnswers(
  questions: ScreeningQuestionRecord[],
  minCorrect: number | null,
  answers: ScreeningAnswerInput[],
  failMessage: string,
): {
  correctCount: number;
  passed: boolean;
  answers: ScoredScreeningAnswer[];
} {
  if (questions.length === 0) {
    return { correctCount: 0, passed: true, answers: [] };
  }

  const byId = new Map(answers.map((item) => [item.questionId, item]));
  if (answers.length !== questions.length) {
    throw new BadRequestException(
      'Debes responder todas las preguntas de screening.',
    );
  }
  for (const question of questions) {
    if (!byId.has(question.id)) {
      throw new BadRequestException(
        'Debes responder todas las preguntas de screening.',
      );
    }
  }

  const scored = questions.map((question) =>
    scoreScreeningAnswer(question, byId.get(question.id)!),
  );
  const correctCount = scored.filter((item) => item.isCorrect).length;
  const required = minCorrect ?? questions.length;
  const passed = correctCount >= required;
  if (!passed) {
    throw new BadRequestException(failMessage);
  }
  return { correctCount, passed, answers: scored };
}

function scoreScreeningAnswer(
  question: ScreeningQuestionRecord,
  answer: ScreeningAnswerInput,
): ScoredScreeningAnswer {
  const type = question.type ?? VacancyScreeningQuestionType.YES_NO;
  if (isBooleanScreeningType(type)) {
    if (typeof answer.answer !== 'boolean') {
      throw new BadRequestException(
        'Debes responder todas las preguntas de screening.',
      );
    }
    const correctAnswer = question.correctAnswer === true;
    return {
      questionId: question.id,
      questionType: type,
      questionPrompt: question.prompt,
      optionsSnapshot: null,
      correctAnswer,
      answer: answer.answer,
      correctOptionIds: null,
      selectedOptionIds: null,
      isCorrect: answer.answer === correctAnswer,
      sortOrder: question.sortOrder,
    };
  }

  const options = parseScreeningOptions(question.options);
  const selectedOptionIds = parseStringIds(answer.selectedOptionIds);
  if (selectedOptionIds.length === 0) {
    throw new BadRequestException(
      'Debes responder todas las preguntas de screening.',
    );
  }
  const knownIds = new Set(options.map((option) => option.id));
  if (selectedOptionIds.some((id) => !knownIds.has(id))) {
    throw new BadRequestException('Hay una respuesta de screening no válida.');
  }
  if (
    type === VacancyScreeningQuestionType.SINGLE_CHOICE &&
    selectedOptionIds.length !== 1
  ) {
    throw new BadRequestException(
      'Las preguntas de única respuesta admiten una sola alternativa.',
    );
  }

  const expected = expandSelectedOptionIds(
    parseStringIds(question.correctOptionIds),
    options,
    type,
  );
  const actual = expandSelectedOptionIds(selectedOptionIds, options, type);
  return {
    questionId: question.id,
    questionType: type,
    questionPrompt: question.prompt,
    optionsSnapshot: options,
    correctAnswer: null,
    answer: null,
    correctOptionIds: parseStringIds(question.correctOptionIds),
    selectedOptionIds,
    isCorrect: sameIdSet(expected, actual),
    sortOrder: question.sortOrder,
  };
}

export function screeningJson(
  value: ScreeningOption[] | string[] | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
