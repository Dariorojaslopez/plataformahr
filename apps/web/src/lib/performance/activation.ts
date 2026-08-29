import { evaluatorWeightsAreValid } from "@/lib/performance/evaluator-weights";
import { canActivateWeights } from "@/lib/performance/weights";
import type { PerformanceCycleStatus } from "@/types/performance";

export function canEditCycleStructure(status: PerformanceCycleStatus): boolean {
  return status === "DRAFT";
}

export function canEditCycleMetadata(status: PerformanceCycleStatus): boolean {
  return status === "DRAFT";
}

export function canEditEvaluatorWeights(
  status: PerformanceCycleStatus,
): boolean {
  return status === "DRAFT";
}

export function canActivateCycle(input: {
  status: PerformanceCycleStatus;
  competencyCount: number;
  weights: Array<string | number | null | undefined>;
  includeCompetencies?: boolean;
  selfEvaluationWeight?: string | number | null;
  managerEvaluationWeight?: string | number | null;
  evaluationModel?: import("@/types/performance").PerformanceEvaluationModel;
  peerEvaluationWeight?: string | number | null;
  reportEvaluationWeight?: string | number | null;
  clientEvaluationWeight?: string | number | null;
}): boolean {
  if (input.status !== "DRAFT") return false;
  if (input.includeCompetencies !== false && input.competencyCount < 1) {
    return false;
  }
  if (
    input.includeCompetencies !== false &&
    !canActivateWeights(input.weights)
  ) {
    return false;
  }
  if (
    input.selfEvaluationWeight != null ||
    input.managerEvaluationWeight != null
  ) {
    return evaluatorWeightsAreValid(
      input.selfEvaluationWeight,
      input.managerEvaluationWeight,
      {
        model: input.evaluationModel,
        peer: input.peerEvaluationWeight,
        report: input.reportEvaluationWeight,
        client: input.clientEvaluationWeight,
      },
    );
  }
  return true;
}

export function canCloseCycle(status: PerformanceCycleStatus): boolean {
  return status === "ACTIVE";
}

export function canCancelCycle(status: PerformanceCycleStatus): boolean {
  return status === "DRAFT" || status === "ACTIVE";
}
