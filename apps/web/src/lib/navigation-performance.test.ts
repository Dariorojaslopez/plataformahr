import { describe, expect, it } from "vitest";
import { APP_NAV, resolvePageTitle } from "@/lib/navigation";

describe("performance navigation", () => {
  it("exposes enabled Performance nav items with correct hrefs", () => {
    const section = APP_NAV.find((s) => s.title === "Performance");
    expect(section).toBeDefined();
    const items = section!.items;

    expect(items.map(({ label, href, disabled }) => ({ label, href, disabled }))).toEqual([
      { label: "Ciclos", href: "/performance/cycles", disabled: undefined },
      {
        label: "Mis evaluaciones",
        href: "/performance/my-evaluations",
        disabled: undefined,
      },
      {
        label: "Mis resultados",
        href: "/performance/my-results",
        disabled: undefined,
      },
      {
        label: "Resultados",
        href: "/performance/results",
        disabled: undefined,
      },
      {
        label: "Competencias",
        href: "/performance/competencies",
        disabled: undefined,
      },
      { label: "Escalas", href: "/performance/scales", disabled: undefined },
    ]);
    expect(items).toHaveLength(6);
  });

  it("resolves page titles for performance routes", () => {
    expect(resolvePageTitle("/performance/cycles")).toBe("Ciclos");
    expect(resolvePageTitle("/performance/my-evaluations")).toBe(
      "Mis evaluaciones",
    );
    expect(resolvePageTitle("/performance/my-results")).toBe("Mis resultados");
    expect(resolvePageTitle("/performance/results")).toBe("Resultados");
    expect(resolvePageTitle("/performance/competencies")).toBe("Competencias");
    expect(resolvePageTitle("/performance/scales")).toBe("Escalas");
    expect(resolvePageTitle("/performance/cycles/abc")).toBe("Ciclo");
    expect(resolvePageTitle("/performance/scales/abc")).toBe("Escala");
    expect(resolvePageTitle("/performance/evaluations/abc")).toBe("Evaluación");
    expect(resolvePageTitle("/performance/results/abc")).toBe("Resultado");
    expect(resolvePageTitle("/performance/my-results/abc")).toBe("Mi resultado");
  });
});
