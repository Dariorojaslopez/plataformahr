import { describe, expect, it } from "vitest";
import { buildPositionProfileHtml } from "@/components/organization/position-profile-print";

describe("position profile print", () => {
  it("includes the job description and the competencies to evaluate", () => {
    const html = buildPositionProfileHtml({
      name: "Director de contabilidad",
      areaName: "Gestión contable",
      levelName: "N2",
      reportsToName: "Gerente administrativo y financiero",
      headcount: "1",
      statusLabel: "Activo",
      mission: "Dirigir la operación contable.",
      responsibilities: "Estados financieros.",
      requiredExperience: "5 años",
      requiredEducation: "Contaduría",
      customFields: [],
      competencies: [
        {
          name: "Orientación a resultados",
          description: "Cumple metas con calidad.",
        },
        { name: "Liderazgo", description: null },
      ],
      competenciesNote: null,
    });

    expect(html).toContain("Perfil del cargo");
    expect(html).toContain("Director de contabilidad");
    expect(html).toContain("Dirigir la operación contable.");
    expect(html).toContain("Competencias a evaluar");
    expect(html).toContain("Orientación a resultados");
    expect(html).toContain("Cumple metas con calidad.");
    expect(html).toContain("Liderazgo");
  });

  it("explains when the position has no level competencies", () => {
    const html = buildPositionProfileHtml({
      name: "Auxiliar",
      areaName: "Contabilidad",
      levelName: null,
      reportsToName: null,
      headcount: "1",
      statusLabel: "Activo",
      mission: "",
      responsibilities: "",
      requiredExperience: "",
      requiredEducation: "",
      customFields: [],
      competencies: [],
      competenciesNote:
        "Este cargo no tiene nivel. Las competencias se definen en el nivel del cargo.",
    });

    expect(html).toContain("Competencias a evaluar");
    expect(html).toContain("Este cargo no tiene nivel.");
  });

  it("escapes text that could break the document", () => {
    const html = buildPositionProfileHtml({
      name: "Cargo <script>",
      areaName: "A & B",
      levelName: null,
      reportsToName: null,
      headcount: "1",
      statusLabel: "Activo",
      mission: "",
      responsibilities: "",
      requiredExperience: "",
      requiredEducation: "",
      customFields: [],
      competencies: [{ name: "Análisis <datos>", description: null }],
      competenciesNote: null,
    });

    expect(html).toContain("Cargo &lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("Análisis &lt;datos&gt;");
    expect(html).not.toContain("<script>Cargo");
  });
});
