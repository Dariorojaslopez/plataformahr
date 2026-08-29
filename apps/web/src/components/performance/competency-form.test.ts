import { describe, expect, it } from "vitest";
import {
  competencyJobLevelLabel,
  competencyToForm,
  emptyCompetencyForm,
  toCreateCompetencyPayload,
  toUpdateCompetencyPayload,
} from "@/components/performance/competency-form";
import type { Competency } from "@/types/performance";

const competency: Competency = {
  id: "c1",
  companyId: "co1",
  name: "Liderazgo",
  code: "001",
  description: "Guía equipos",
  status: "ACTIVE",
  defaultScaleId: "scale-1",
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
  jobLevels: [
    { id: "jl-1", name: "Senior", rank: 3, status: "ACTIVE" },
  ],
};

describe("competency form payloads", () => {
  it("starts empty without code or scale", () => {
    expect(emptyCompetencyForm()).toEqual({
      name: "",
      description: "",
      status: "ACTIVE",
      jobLevelId: "",
    });
  });

  it("loads the assigned job level and omits code and default scale", () => {
    expect(competencyToForm(competency)).toEqual({
      name: "Liderazgo",
      description: "Guía equipos",
      status: "ACTIVE",
      jobLevelId: "jl-1",
    });
  });

  it("creates with the selected job level and no scale", () => {
    expect(
      toCreateCompetencyPayload({
        name: " Liderazgo ",
        description: " Guía equipos ",
        status: "ACTIVE",
        jobLevelId: "jl-1",
      }),
    ).toEqual({
      name: "Liderazgo",
      description: "Guía equipos",
      status: "ACTIVE",
      jobLevelId: "jl-1",
    });
  });

  it("updates the assigned job level", () => {
    expect(
      toUpdateCompetencyPayload({
        name: "Liderazgo",
        description: "",
        status: "INACTIVE",
        jobLevelId: "jl-2",
      }),
    ).toEqual({
      name: "Liderazgo",
      description: null,
      status: "INACTIVE",
      jobLevelId: "jl-2",
    });
  });

  it("joins assigned level names for the table", () => {
    expect(competencyJobLevelLabel(competency.jobLevels)).toBe("Senior");
    expect(competencyJobLevelLabel([])).toBe("—");
  });
});
