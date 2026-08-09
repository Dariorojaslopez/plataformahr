import { describe, expect, it } from "vitest";
import { mapSnapshotCompetenciesForDisplay } from "@/lib/performance/snapshot-view";
import type { EvaluationSnapshotCompetency } from "@/types/performance";

describe("snapshot view", () => {
  it("maps evaluation competencies for display without catalog fields", () => {
    const competencies: EvaluationSnapshotCompetency[] = [
      {
        id: "snap-2",
        sourceCompetencyId: "live-comp-b",
        sourceScaleId: "live-scale-b",
        name: "Liderazgo",
        code: "LID",
        description: "Histórico",
        scaleName: "Escala A (snapshot)",
        weight: "40.00",
        required: true,
        order: 2,
        levels: [
          {
            id: "lvl-2",
            sourceScaleLevelId: "src-2",
            value: 2,
            label: "Alto",
            description: null,
            order: 2,
          },
          {
            id: "lvl-1",
            sourceScaleLevelId: "src-1",
            value: 1,
            label: "Bajo",
            description: null,
            order: 1,
          },
        ],
      },
      {
        id: "snap-1",
        sourceCompetencyId: "live-comp-a",
        sourceScaleId: "live-scale-a",
        name: "Comunicación",
        code: null,
        description: null,
        scaleName: "Escala B",
        weight: null,
        required: false,
        order: 1,
        levels: [],
      },
    ];

    const views = mapSnapshotCompetenciesForDisplay(competencies);

    expect(views.map((v) => v.id)).toEqual(["snap-1", "snap-2"]);
    expect(views[0]).toMatchObject({
      name: "Comunicación",
      scaleName: "Escala B",
      weightLabel: "—",
      required: false,
    });
    expect(views[1].weightLabel).toBe("40.00%");
    expect(views[1].levels.map((l) => l.label)).toEqual(["Bajo", "Alto"]);
    expect(views[1]).not.toHaveProperty("sourceCompetencyId");
  });
});
