export type IncomingLevelCompetency = {
  competencyId: string;
  scaleId: string | null;
};

export type CycleCompetencyImportRow = {
  competencyId: string;
  scaleId: string;
  order: number;
  required: true;
};

export function buildCycleCompetencyImports(params: {
  existingCompetencyIds: Iterable<string>;
  incoming: IncomingLevelCompetency[];
  startingOrder: number;
}): { rows: CycleCompetencyImportRow[]; missingScaleIds: string[] } {
  const existing = new Set(params.existingCompetencyIds);
  const seen = new Set<string>();
  const rows: CycleCompetencyImportRow[] = [];
  const missingScaleIds: string[] = [];
  let order = params.startingOrder;

  for (const item of params.incoming) {
    if (existing.has(item.competencyId) || seen.has(item.competencyId)) {
      continue;
    }
    seen.add(item.competencyId);
    if (!item.scaleId) {
      missingScaleIds.push(item.competencyId);
      continue;
    }
    rows.push({
      competencyId: item.competencyId,
      scaleId: item.scaleId,
      order,
      required: true,
    });
    order += 1;
  }

  return { rows, missingScaleIds };
}

export function competencyIdsOnlyOnRemovedLevels(params: {
  removedCompetencyIds: Iterable<string>;
  remainingCompetencyIds: Iterable<string>;
}): string[] {
  const remaining = new Set(params.remainingCompetencyIds);
  return [...new Set(params.removedCompetencyIds)].filter(
    (id) => !remaining.has(id),
  );
}
