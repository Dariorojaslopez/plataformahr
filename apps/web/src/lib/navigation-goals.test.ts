import { describe, expect, it } from "vitest";
import { APP_NAV, resolvePageTitle } from "@/lib/navigation";

describe("goals navigation", () => {
  it("places organizational objectives under Performance", () => {
    const section = APP_NAV.find((s) => s.title === "Performance");
    expect(section?.items.map((i) => i.href)).toContain("/goals");
    expect(section?.items.find((i) => i.href === "/goals")?.label).toBe(
      "Objetivos organizacionales",
    );
    expect(APP_NAV.find((s) => s.title === "Objetivos")).toBeUndefined();
  });

  it("does not expose removed goal menu items", () => {
    const hrefs = APP_NAV.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/goals/cycles");
    expect(hrefs).not.toContain("/my-goals");
    expect(hrefs).not.toContain("/goals/team");
    expect(hrefs).not.toContain("/goals/reviews");
  });

  it("resolves titles", () => {
    expect(resolvePageTitle("/goals")).toBe("Objetivos organizacionales");
    expect(resolvePageTitle("/my-goals")).toBe("Mis objetivos");
    expect(resolvePageTitle("/goals/cycles")).toBe("Periodos");
    expect(resolvePageTitle("/goals/team")).toBe("Mi equipo");
    expect(resolvePageTitle("/goals/reviews")).toBe("Revisión de cierres");
  });
});
