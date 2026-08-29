import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildPdfFromJpeg } from "@/components/organization/org-chart-export";
import {
  layoutOrgChart,
  layoutToSvg,
} from "@/components/organization/org-chart-layout";
import { OrgChartTree } from "@/components/organization/org-chart-tree";
import {
  OrgChartViewport,
  clampScale,
} from "@/components/organization/org-chart-viewport";
import type { OrgChartNode } from "@/types/organization";

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
  cleanup();
});

function node(
  partial: Pick<OrgChartNode, "employeeId" | "firstName" | "lastName"> &
    Partial<OrgChartNode>,
): OrgChartNode {
  return {
    status: "ACTIVE",
    managerId: null,
    position: { id: `p-${partial.employeeId}`, name: "Analista" },
    jobLevel: { id: "jl", name: "Junior", rank: 1 },
    area: { id: "a", name: "Operaciones" },
    businessUnit: null,
    children: [],
    ...partial,
  };
}

const manager = node({
  employeeId: "mgr",
  firstName: "Ana",
  lastName: "Jefe",
  position: { id: "p-mgr", name: "Gerente" },
  children: [
    node({
      employeeId: "emp",
      firstName: "Luis",
      lastName: "Reporte",
      managerId: "mgr",
    }),
  ],
});

const secondRoot = node({
  employeeId: "solo",
  firstName: "Marta",
  lastName: "Independiente",
  position: { id: "p-solo", name: "Especialista" },
});

describe("org chart layout and export", () => {
  it("lays out a company node plus multiple roots", () => {
    const layout = layoutOrgChart("Acme", [manager, secondRoot]);
    expect(layout.nodes.some((item) => item.kind === "company")).toBe(true);
    expect(layout.nodes.map((item) => item.id)).toEqual(
      expect.arrayContaining(["company", "mgr", "emp", "solo"]),
    );
    const svg = layoutToSvg(layout, { generatedAt: "2026-08-17" });
    expect(svg).toContain("Acme");
    expect(svg).toContain("Ana Jefe");
    expect(svg).toContain("Marta Independiente");
    expect(svg).toContain("Generado 2026-08-17");
  });

  it("builds a PDF that starts with a valid header", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdfFromJpeg(jpeg, 400, 300);
    const text = new TextDecoder().decode(pdf.slice(0, 8));
    expect(text.startsWith("%PDF-1.")).toBe(true);
    expect(new TextDecoder().decode(pdf).includes("%%EOF")).toBe(true);
  });

  it("clamps zoom", () => {
    expect(clampScale(0.1)).toBe(0.4);
    expect(clampScale(8)).toBe(2);
  });
});

describe("OrgChartTree", () => {
  it("renders the tree, multiple roots and profile links", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <OrgChartTree
        companyName="Acme"
        roots={[manager, secondRoot]}
        collapsedIds={new Set()}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByTestId("org-chart-tree")).toHaveClass("org-chart-tree");
    const companyNode = screen.getByText("Acme").closest("div");
    expect(companyNode).toHaveClass("bg-primary", "text-primary-foreground");
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ana Jefe" })).toHaveAttribute(
      "href",
      "/organization/employees/mgr",
    );
    expect(screen.getByText("Luis Reporte")).toBeInTheDocument();
    expect(screen.getByText("Marta Independiente")).toBeInTheDocument();
    expect(screen.getAllByText("Operaciones").length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText("Contraer rama"));
    expect(onToggle).toHaveBeenCalledWith("mgr");
  });
});

describe("OrgChartViewport", () => {
  it("zooms and pans the canvas", () => {
    const onScaleChange = vi.fn();
    const onPanChange = vi.fn();
    render(
      <OrgChartViewport
        scale={1}
        pan={{ x: 0, y: 0 }}
        onScaleChange={onScaleChange}
        onPanChange={onPanChange}
      >
        <div>chart</div>
      </OrgChartViewport>,
    );

    const canvas = screen.getByTestId("org-chart-canvas");
    expect(canvas.style.transform).toContain("scale(1)");
    fireEvent.wheel(canvas.parentElement!, { deltaY: -120 });
    expect(onScaleChange).toHaveBeenCalled();
    fireEvent.pointerDown(canvas.parentElement!, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas.parentElement!, { clientX: 40, clientY: 25 });
    expect(onPanChange).toHaveBeenCalled();
  });
});
