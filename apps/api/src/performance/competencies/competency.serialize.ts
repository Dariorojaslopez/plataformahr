export type CompetencyJobLevelRef = {
  id: string;
  name: string;
  rank: number;
  status: string;
};

export function serializeCompetency<
  T extends { jobLevelAssignments: Array<{ jobLevel: CompetencyJobLevelRef }> },
>(row: T): Omit<T, 'jobLevelAssignments'> & {
  jobLevels: CompetencyJobLevelRef[];
} {
  const { jobLevelAssignments, ...rest } = row;
  return {
    ...rest,
    jobLevels: jobLevelAssignments.map((assignment) => assignment.jobLevel),
  };
}
