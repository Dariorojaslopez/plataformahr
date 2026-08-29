import { describe, expect, it } from "vitest";
import { performanceKeys } from "@/lib/api/performance";

describe("performance query keys tenant isolation", () => {
  it("scopes list and detail keys by companyId as second element", () => {
    const a = performanceKeys.cycles("company-a", { page: 1 });
    const b = performanceKeys.cycles("company-b", { page: 1 });
    expect(a[1]).toBe("company-a");
    expect(b[1]).toBe("company-b");
    expect(a).not.toEqual(b);

    expect(performanceKeys.cycle("c1", "cycle-1")[1]).toBe("c1");
    expect(performanceKeys.competency("c1", "comp-1")[1]).toBe("c1");
    expect(performanceKeys.scale("c1", "scale-1")[1]).toBe("c1");
    expect(performanceKeys.cycleCompetencies("c1", "cycle-1")[1]).toBe("c1");
  });

  it("keeps company boundaries across collections", () => {
    expect(performanceKeys.all("a")).not.toEqual(performanceKeys.all("b"));
    expect(performanceKeys.competencies("a", {})[1]).toBe("a");
    expect(performanceKeys.scales("b", {})[1]).toBe("b");
  });

  it("scopes participants and evaluations keys by companyId", () => {
    expect(performanceKeys.participants("c1", "cycle-1", { page: 1 })[1]).toBe(
      "c1",
    );
    expect(performanceKeys.participant("c1", "cycle-1", "p1")[1]).toBe("c1");
    expect(performanceKeys.assignedEmployeeIds("c1", "cycle-1")[1]).toBe("c1");
    expect(performanceKeys.evaluationsMine("c1")[1]).toBe("c1");
    expect(performanceKeys.evaluation("c1", "eval-1")[1]).toBe("c1");

    expect(performanceKeys.evaluationsMine("a")).not.toEqual(
      performanceKeys.evaluationsMine("b"),
    );
    expect(performanceKeys.goalDefinition("c1", "cycle-1")[1]).toBe("c1");
    expect(performanceKeys.goalDefinition("a", "x")).not.toEqual(
      performanceKeys.goalDefinition("b", "x"),
    );
  });

  it("scopes results keys by companyId", () => {
    expect(performanceKeys.results("c1", { page: 1 })[1]).toBe("c1");
    expect(performanceKeys.result("c1", "r1")[1]).toBe("c1");
    expect(performanceKeys.resultsMine("c1")[1]).toBe("c1");
    expect(performanceKeys.resultsMine("a")).not.toEqual(
      performanceKeys.resultsMine("b"),
    );
  });

  it("scopes analytics keys by companyId and cycleId", () => {
    expect(performanceKeys.analytics("c1", "cycle-1")).toEqual([
      "performance",
      "c1",
      "analytics",
      "cycle-1",
    ]);
    expect(performanceKeys.analytics("a", "x")).not.toEqual(
      performanceKeys.analytics("b", "x"),
    );
  });
});
