export type PositionProfileField = {
  label: string;
  value: string;
};

export type PositionProfileCompetency = {
  name: string;
  description: string | null;
};

export type PositionProfileDocument = {
  name: string;
  areaName: string;
  levelName: string | null;
  reportsToName: string | null;
  headcount: string;
  statusLabel: string;
  mission: string;
  responsibilities: string;
  requiredExperience: string;
  requiredEducation: string;
  customFields: PositionProfileField[];
  competencies: PositionProfileCompetency[];
  competenciesNote: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraph(title: string, body: string): string {
  const text = body.trim();
  if (!text) return "";
  return `<section><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`;
}

function competenciesSection(document: PositionProfileDocument): string {
  if (document.competenciesNote && document.competencies.length === 0) {
    return `<section><h2>Competencias a evaluar</h2><p>${escapeHtml(document.competenciesNote)}</p></section>`;
  }
  const items = document.competencies
    .map((competency) => {
      const description = competency.description?.trim();
      return `<li><strong>${escapeHtml(competency.name)}</strong>${
        description
          ? `<div class="comp-desc">${escapeHtml(description)}</div>`
          : ""
      }</li>`;
    })
    .join("");
  return `<section><h2>Competencias a evaluar</h2><ol>${items}</ol></section>`;
}

export function buildPositionProfileHtml(
  document: PositionProfileDocument,
): string {
  const meta: PositionProfileField[] = [
    { label: "Área", value: document.areaName || "—" },
    { label: "Nivel", value: document.levelName?.trim() || "Sin nivel" },
    {
      label: "Cargo al que reporta",
      value: document.reportsToName?.trim() || "Ninguno",
    },
    { label: "Plazas", value: document.headcount || "—" },
    { label: "Estado", value: document.statusLabel || "—" },
  ];
  const metaHtml = meta
    .map(
      (field) =>
        `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd></div>`,
    )
    .join("");
  const customHtml = document.customFields
    .filter((field) => field.value.trim())
    .map(
      (field) =>
        `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd></div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Perfil del cargo — ${escapeHtml(document.name)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 2rem; line-height: 1.45; }
    h1 { font-size: 1.7rem; margin: 0 0 0.25rem; }
    .subtitle { margin: 0; color: #444; font-size: 0.95rem; }
    h2 { font-size: 1rem; margin: 1.4rem 0 0.4rem; border-bottom: 1px solid #ccc; padding-bottom: 0.15rem; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 1.5rem; margin: 1rem 0 0; }
    dt { font-size: 0.75rem; color: #555; }
    dd { margin: 0 0 0.35rem; }
    p, li { white-space: pre-wrap; }
    ol { margin: 0.4rem 0 0; padding-left: 1.2rem; }
    .comp-desc { font-weight: normal; color: #333; margin-top: 0.15rem; }
    @media print { body { margin: 0.5rem; } }
  </style>
</head>
<body>
  <p class="subtitle">Perfil del cargo</p>
  <h1>${escapeHtml(document.name)}</h1>
  <dl>${metaHtml}</dl>
  ${paragraph("Misión", document.mission)}
  ${paragraph("Responsabilidades", document.responsibilities)}
  ${paragraph("Experiencia requerida", document.requiredExperience)}
  ${paragraph("Educación requerida", document.requiredEducation)}
  ${customHtml ? `<section><h2>Información adicional</h2><dl>${customHtml}</dl></section>` : ""}
  ${competenciesSection(document)}
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;
}

export function printPositionProfile(document: PositionProfileDocument): boolean {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(buildPositionProfileHtml(document));
  popup.document.close();
  return true;
}
