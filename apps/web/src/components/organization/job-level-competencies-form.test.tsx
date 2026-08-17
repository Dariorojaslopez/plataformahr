import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JobLevelCompetenciesForm,
  selectedCompetencyIds,
  toReplaceCompetenciesPayload,
} from "@/components/organization/job-level-competencies-form";
import type { JobLevelCompetencyItem } from "@/types/organization";

afterEach(() => {
  cleanup();
});

const catalog: JobLevelCompetencyItem[] = [
  {
    id: "c-team",
    name: "Trabajo en equipo",
    code: "TE",
    status: "ACTIVE",
  },
  {
    id: "c-lead",
    name: "Liderazgo",
    code: null,
    status: "ACTIVE",
  },
];

describe("job level competency payloads", () => {
  it("maps assigned selection and allows an empty replace", () => {
    expect(selectedCompetencyIds(catalog)).toEqual(["c-team", "c-lead"]);
    expect(toReplaceCompetenciesPayload([])).toEqual({ competencyIds: [] });
    expect(toReplaceCompetenciesPayload(["c-team"])).toEqual({
      competencyIds: ["c-team"],
    });
  });
});

describe("JobLevelCompetenciesForm", () => {
  it("loads the current selection and saves toggles without requiring any", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <JobLevelCompetenciesForm
        catalog={catalog}
        selectedIds={["c-team"]}
        onChange={onChange}
      />,
    );

    const team = document.getElementById("jl-comp-c-team");
    const lead = document.getElementById("jl-comp-c-lead");
    expect(team).toHaveAttribute("data-state", "checked");
    expect(lead).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByText("TE")).toBeInTheDocument();
    expect(
      screen.getByText("Opcional. Una competencia puede pertenecer a varios niveles."),
    ).toBeInTheDocument();

    await user.click(lead!);
    expect(onChange).toHaveBeenCalledWith(["c-team", "c-lead"]);
  });
});
