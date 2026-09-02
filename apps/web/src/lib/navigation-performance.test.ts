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
        label: "Seleccionar población a evaluar",
        href: "/performance/population",
        disabled: undefined,
      },
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
        label: "Objetivos organizacionales",
        href: "/goals",
        disabled: undefined,
      },
      {
        label: "9Box",
        href: "/performance/9box",
        disabled: undefined,
      },
      {
        label: "Calibración",
        href: "/performance/calibration",
        disabled: undefined,
      },
    ]);
    expect(items).toHaveLength(8);
  });

  it("places competencias under Organización", () => {
    const section = APP_NAV.find((s) => s.title === "Organización");
    expect(section?.items.map(({ label, href }) => ({ label, href }))).toEqual(
      expect.arrayContaining([
        { label: "Competencias", href: "/organization/competencies" },
      ]),
    );
    expect(
      APP_NAV.find((s) => s.title === "Performance")?.items.map(
        ({ label }) => label,
      ),
    ).not.toContain("Competencias");
  });

  it("places escalas de calificación under Organización", () => {
    const section = APP_NAV.find((s) => s.title === "Organización");
    expect(section?.items.map(({ label, href }) => ({ label, href }))).toEqual(
      expect.arrayContaining([
        {
          label: "Escalas de calificación",
          href: "/organization/scales",
        },
      ]),
    );
    expect(
      APP_NAV.find((s) => s.title === "Performance")?.items.map(
        ({ label }) => label,
      ),
    ).not.toContain("Escalas");
    expect(
      APP_NAV.find((s) => s.title === "Performance")?.items.map(
        ({ label }) => label,
      ),
    ).not.toContain("Escalas de calificación");
  });

  it("resolves page titles for performance routes", () => {
    expect(resolvePageTitle("/performance/cycles")).toBe("Ciclos");
    expect(resolvePageTitle("/performance/my-evaluations")).toBe(
      "Mis evaluaciones",
    );
    expect(resolvePageTitle("/performance/my-evaluations/abc")).toBe(
      "Mis evaluaciones",
    );
    expect(resolvePageTitle("/performance/my-results")).toBe("Mis resultados");
    expect(resolvePageTitle("/performance/results")).toBe("Resultados");
    expect(resolvePageTitle("/organization/competencies")).toBe("Competencias");
    expect(resolvePageTitle("/performance/competencies")).toBe("Competencias");
    expect(resolvePageTitle("/organization/scales")).toBe(
      "Escalas de calificación",
    );
    expect(resolvePageTitle("/performance/scales")).toBe(
      "Escalas de calificación",
    );
    expect(resolvePageTitle("/performance/cycles/abc")).toBe("Ciclo");
    expect(resolvePageTitle("/organization/scales/abc")).toBe("Escala");
    expect(resolvePageTitle("/performance/scales/abc")).toBe("Escala");
    expect(resolvePageTitle("/performance/evaluations/abc")).toBe("Evaluación");
    expect(resolvePageTitle("/performance/results/abc")).toBe("Resultado");
    expect(resolvePageTitle("/performance/my-results/abc")).toBe("Mi resultado");
    expect(resolvePageTitle("/performance/population")).toBe(
      "Seleccionar población a evaluar",
    );
    expect(resolvePageTitle("/performance/calibration")).toBe("Calibración");
    expect(resolvePageTitle("/performance/9box")).toBe("9Box");
    expect(resolvePageTitle("/organization/settings")).toBe(
      "Ajustes de resultados",
    );
  });
});
