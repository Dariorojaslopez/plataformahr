import type { OrgChartNode } from "@/types/organization";

export const ORG_CARD_WIDTH = 220;
export const ORG_CARD_HEIGHT = 108;
export const ORG_GAP_X = 28;
export const ORG_GAP_Y = 56;

export type LaidOutNode = {
  id: string;
  kind: "company" | "employee";
  label: string;
  subtitle: string;
  meta: string;
  href?: string;
  status?: OrgChartNode["status"];
  x: number;
  y: number;
};

export type OrgChartEdge = { from: string; to: string };

export type OrgChartLayout = {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: OrgChartEdge[];
};

function nodeSubtreeWidth(node: OrgChartNode): number {
  if (node.children.length === 0) return ORG_CARD_WIDTH;
  return Math.max(
    ORG_CARD_WIDTH,
    node.children.reduce((sum, child, index) => {
      return sum + nodeSubtreeWidth(child) + (index > 0 ? ORG_GAP_X : 0);
    }, 0),
  );
}

function cardMeta(node: OrgChartNode): string {
  const parts = [node.area.name];
  if (node.businessUnit) parts.push(node.businessUnit.name);
  if (node.jobLevel) parts.push(node.jobLevel.name);
  return parts.join(" · ");
}

function layoutEmployee(
  node: OrgChartNode,
  left: number,
  top: number,
  acc: OrgChartLayout,
): number {
  const width = nodeSubtreeWidth(node);
  const x = left + width / 2 - ORG_CARD_WIDTH / 2;
  acc.nodes.push({
    id: node.employeeId,
    kind: "employee",
    label: `${node.firstName} ${node.lastName}`,
    subtitle: node.position.name,
    meta: cardMeta(node),
    href: `/organization/employees/${node.employeeId}`,
    status: node.status,
    x,
    y: top,
  });
  let childLeft = left;
  for (const child of node.children) {
    const childWidth = nodeSubtreeWidth(child);
    acc.edges.push({ from: node.employeeId, to: child.employeeId });
    layoutEmployee(child, childLeft, top + ORG_CARD_HEIGHT + ORG_GAP_Y, acc);
    childLeft += childWidth + ORG_GAP_X;
  }
  acc.width = Math.max(acc.width, left + width);
  acc.height = Math.max(acc.height, top + ORG_CARD_HEIGHT);
  return width;
}

export function layoutOrgChart(
  companyName: string,
  roots: OrgChartNode[],
): OrgChartLayout {
  const acc: OrgChartLayout = {
    width: ORG_CARD_WIDTH,
    height: ORG_CARD_HEIGHT,
    nodes: [],
    edges: [],
  };
  const forestWidth =
    roots.length === 0
      ? ORG_CARD_WIDTH
      : roots.reduce(
          (sum, root, index) =>
            sum + nodeSubtreeWidth(root) + (index > 0 ? ORG_GAP_X : 0),
          0,
        );
  const companyX = Math.max(0, forestWidth / 2 - ORG_CARD_WIDTH / 2);
  acc.nodes.push({
    id: "company",
    kind: "company",
    label: companyName,
    subtitle: "Compañía",
    meta: "",
    x: companyX,
    y: 0,
  });
  let left = 0;
  const childTop = ORG_CARD_HEIGHT + ORG_GAP_Y;
  for (const root of roots) {
    const width = nodeSubtreeWidth(root);
    acc.edges.push({ from: "company", to: root.employeeId });
    layoutEmployee(root, left, childTop, acc);
    left += width + ORG_GAP_X;
  }
  acc.width = Math.max(acc.width, forestWidth, companyX + ORG_CARD_WIDTH) + 32;
  acc.height += 32;
  return acc;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function layoutToSvg(
  layout: OrgChartLayout,
  options: { generatedAt: string },
): string {
  const lines = layout.edges
    .map((edge) => {
      const from = layout.nodes.find((node) => node.id === edge.from);
      const to = layout.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return "";
      const x1 = from.x + ORG_CARD_WIDTH / 2;
      const y1 = from.y + ORG_CARD_HEIGHT;
      const x2 = to.x + ORG_CARD_WIDTH / 2;
      const y2 = to.y;
      const midY = (y1 + y2) / 2;
      return `<path d="M ${x1} ${y1} V ${midY} H ${x2} V ${y2}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`;
    })
    .join("");
  const cards = layout.nodes
    .map((node) => {
      const fill = node.kind === "company" ? "#0f172a" : "#ffffff";
      const color = node.kind === "company" ? "#ffffff" : "#0f172a";
      const muted = node.kind === "company" ? "#cbd5e1" : "#64748b";
      return `<g>
        <rect x="${node.x}" y="${node.y}" width="${ORG_CARD_WIDTH}" height="${ORG_CARD_HEIGHT}" rx="10" fill="${fill}" stroke="#e2e8f0"/>
        <text x="${node.x + 12}" y="${node.y + 28}" font-size="14" font-family="system-ui,sans-serif" fill="${color}" font-weight="600">${escapeXml(node.label)}</text>
        <text x="${node.x + 12}" y="${node.y + 50}" font-size="12" font-family="system-ui,sans-serif" fill="${muted}">${escapeXml(node.subtitle)}</text>
        <text x="${node.x + 12}" y="${node.y + 70}" font-size="11" font-family="system-ui,sans-serif" fill="${muted}">${escapeXml(node.meta)}</text>
      </g>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height + 28}" viewBox="0 0 ${layout.width} ${layout.height + 28}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="16" y="${layout.height + 18}" font-size="11" font-family="system-ui,sans-serif" fill="#64748b">Generado ${escapeXml(options.generatedAt)}</text>
  ${lines}
  ${cards}
</svg>`;
}
