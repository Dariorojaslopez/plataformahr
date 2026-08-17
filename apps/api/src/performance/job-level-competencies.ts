/**
 * Organizational competencies for an employee's current JobLevel.
 *
 * Performance still selects competencies per cycle (`PerformanceCycleCompetency`).
 * Do not call this from participant materialization yet — historical freeze is
 * the evaluation snapshot copied from the cycle at assignment time.
 *
 * Future consumption:
 * 1. While a cycle is DRAFT, copy `resolveCompetenciesForEmployee` (or the
 *    job-level catalog) into `PerformanceCycleCompetency` if product wants
 *    level-based defaults.
 * 2. Freeze at participant materialization (existing snapshot), never by
 *    reading JobLevelCompetency during calculate/close.
 * 3. Editing JobLevel competencies after evaluations exist must not rewrite
 *    `PerformanceEvaluationCompetency` rows.
 */
export {
  resolveCompetenciesForEmployee,
  type EmployeeJobLevelCompetencies,
  type JobLevelCompetencySummary,
} from '../organization/job-level-competencies';
