"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Button } from "@/components/ui/button";
import type { OrgChartNode } from "@/types/organization";

export function displayEmployeeName(node: OrgChartNode): string {
  return `${node.firstName} ${node.lastName}`;
}

function NodeCard({
  node,
  collapsed,
  onToggle,
}: {
  node: OrgChartNode;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const hasChildren = node.children.length > 0;
  return (
    <article className="w-[220px] rounded-lg border-2 border-border bg-card p-3 text-left text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/organization/employees/${node.employeeId}`}
          className="font-medium leading-tight text-card-foreground hover:underline"
        >
          {displayEmployeeName(node)}
        </Link>
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={collapsed ? "Expandir rama" : "Contraer rama"}
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-card-foreground">{node.position.name}</p>
      <p className="text-xs text-foreground/80">{node.area.name}</p>
      {node.businessUnit ? (
        <p className="text-xs text-foreground/80">{node.businessUnit.name}</p>
      ) : null}
      {node.jobLevel ? (
        <p className="text-xs text-foreground/80">{node.jobLevel.name}</p>
      ) : null}
      {node.status !== "ACTIVE" ? (
        <div className="mt-2">
          <OrgStatusBadge status={node.status} />
        </div>
      ) : null}
    </article>
  );
}

function Branch({
  node,
  collapsedIds,
  onToggle,
}: {
  node: OrgChartNode;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const collapsed = collapsedIds.has(node.employeeId);
  return (
    <li>
      <NodeCard
        node={node}
        collapsed={collapsed}
        onToggle={() => onToggle(node.employeeId)}
      />
      {!collapsed && node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <Branch
              key={child.employeeId}
              node={child}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgChartTree({
  companyName,
  roots,
  collapsedIds,
  onToggle,
}: {
  companyName: string;
  roots: OrgChartNode[];
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      data-testid="org-chart-tree"
      className="org-chart-tree inline-flex min-w-full flex-col items-center px-6 py-8"
    >
      <div className="rounded-lg border-2 border-primary bg-primary px-4 py-3 text-center text-primary-foreground shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground">
          Compañía
        </p>
        <p className="font-semibold">{companyName}</p>
      </div>
      {roots.length > 0 ? (
        <ul>
          {roots.map((root) => (
            <Branch
              key={root.employeeId}
              node={root}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
