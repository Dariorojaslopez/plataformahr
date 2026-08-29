"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompanyBranding } from "@/components/company/company-branding-provider";
import { useSession } from "@/components/auth/session-provider";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { selectionProcessNavLabel } from "@/lib/ats/vacancy-requests-view";
import {
  APP_NAV,
  filterNavigation,
  resolveActiveNavHref,
} from "@/lib/navigation";
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
  const { companyAccess } = useSession();
  const navigation = companyAccess
    ? filterNavigation(APP_NAV, companyAccess)
    : APP_NAV.slice(0, 1);
  const activeHref = resolveActiveNavHref(
    pathname,
    navigation.flatMap(({ items }) => items),
  );
  const branding = useCompanyBranding();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div className="flex min-w-0 items-center gap-2">
            {branding.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoSrc}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-contain bg-white"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {branding.name}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/80">
                Gestión de talento
              </p>
            </div>
          </div>
        ) : branding.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoSrc}
            alt=""
            className="h-8 w-8 rounded object-contain bg-white"
          />
        ) : (
          <span className="text-sm font-semibold">{branding.initials}</span>
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
        {navigation.map((section) => (
          <div key={section.title ?? "main"} className="space-y-1">
            {section.title && !collapsed ? (
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = activeHref === item.href;
              const label =
                item.href === "/ats/vacancy-requests"
                  ? selectionProcessNavLabel(companyAccess?.homeRole)
                  : item.label;

              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-sidebar-foreground/60",
                      collapsed && "justify-center",
                    )}
                    title="Próximamente"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed ? <span>{label}</span> : null}
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-muted",
                    collapsed && "justify-center",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed ? (
                    <span className="leading-snug">{label}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
