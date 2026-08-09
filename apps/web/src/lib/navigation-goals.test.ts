import { describe, expect, it } from "vitest";
import { APP_NAV, resolvePageTitle } from "@/lib/navigation";

describe("goals navigation", () => {
  it("exposes Objetivos section", () => {
    const section = APP_NAV.find((s) => s.title === "Objetivos");
    expect(section?.items.map((i) => i.href)).toEqual([
      "/goals/cycles",
      "/goals",
      "/my-goals",
      "/goals/team",
      "/goals/reviews",
    ]);
  });

  it("resolves titles", () => {
    expect(resolvePageTitle("/goals")).toBe("Objetivos");
    expect(resolvePageTitle("/my-goals")).toBe("Mis objetivos");
    expect(resolvePageTitle("/goals/cycles")).toBe("Periodos");
    expect(resolvePageTitle("/goals/team")).toBe("Mi equipo");
    expect(resolvePageTitle("/goals/reviews")).toBe("Revisión de cierres");
  });

  it("has no ranking or score copy in nav labels", () => {
    const section = APP_NAV.find((s) => s.title === "Objetivos");
    const blob = section?.items.map((i) => i.label).join(" ").toLowerCase() ?? "";
    expect(blob).not.toContain("ranking");
    expect(blob).not.toContain("score");
    expect(blob).not.toContain("performance");
  });
});
