"use client";

import { useRef, type ReactNode } from "react";

const MIN_SCALE = 0.4;
const MAX_SCALE = 2;

export function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

export function OrgChartViewport({
  children,
  scale,
  pan,
  onScaleChange,
  onPanChange,
}: {
  children: ReactNode;
  scale: number;
  pan: { x: number; y: number };
  onScaleChange: (scale: number) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  return (
    <div
      className="h-[min(70vh,720px)] cursor-grab overflow-hidden rounded-lg border border-border bg-muted/30 active:cursor-grabbing"
      onWheel={(event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        onScaleChange(clampScale(scale + delta));
      }}
      onPointerDown={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("a, button, input, label")
        ) {
          return;
        }
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          panX: pan.x,
          panY: pan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onPanChange({
          x: drag.current.panX + (event.clientX - drag.current.x),
          y: drag.current.panY + (event.clientY - drag.current.y),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <div
        data-testid="org-chart-canvas"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
