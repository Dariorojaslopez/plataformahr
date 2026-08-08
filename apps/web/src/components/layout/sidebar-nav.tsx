"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { APP_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
};

export function SidebarNav({
  collapsed = false,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle = false,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div>
            <p className="text-sm font-semibold tracking-tight">Talento Sin Clave</p>
            <p className="text-[11px] text-sidebar-foreground/60">Gestión de talento</p>
          </div>
        ) : (
          <span className="text-sm font-semibold">TS</span>
        )}
        {showCollapseToggle && onToggleCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-muted"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3" aria-label="Principal">
        {APP_NAV.map((section) => (
          <div key={section.title ?? "main"} className="space-y-1">
            {section.title && !collapsed ? (
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(`${item.href}/`));

              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground/40",
                      collapsed && "justify-center",
                    )}
                    title="Próximamente"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-muted",
                    collapsed && "justify-center",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
