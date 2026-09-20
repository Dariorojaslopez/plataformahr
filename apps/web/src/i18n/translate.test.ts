import { describe, expect, it } from "vitest";
import { translate } from "@/i18n/translate";

describe("translate", () => {
  it("keeps Spanish as the source language", () => {
    expect(translate("es", "Cerrar sesión")).toBe("Cerrar sesión");
    expect(translate("es", "Mis evaluaciones")).toBe("Mis evaluaciones");
  });

  it("translates chrome and required fields exactly", () => {
    expect(translate("en", "Cerrar sesión")).toBe("Sign out");
    expect(translate("en", "Título *")).toBe("Title *");
    expect(translate("pt", "Objetivos organizacionales")).toBe(
      "Objetivos organizacionais",
    );
    expect(translate("pt", "Mis evaluaciones")).toBe("Minhas avaliações");
    expect(translate("fr", "Cerrar sesión")).toBe("Se déconnecter");
    expect(translate("it", "Mis evaluaciones")).toBe("Le mie valutazioni");
  });

  it("returns the original text when there is no entry", () => {
    expect(translate("en", "Texto que no existe aún")).toBe(
      "Texto que no existe aún",
    );
  });

  it("interpolates variables after translating", () => {
    expect(
      translate("en", "Hola {name}, elige el contexto con el que quieres trabajar.", {
        name: "Oscar",
      }),
    ).toBe("Hi Oscar, choose the company you want to work with.");
  });
});
