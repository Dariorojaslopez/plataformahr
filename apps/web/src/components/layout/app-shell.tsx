"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
} from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    () => false,
  );

  const toggle = useCallback(() => {
    setSidebarCollapsed(!getSidebarCollapsed());
  }, []);

  return (
    <AuthGuard requireCompany>
      <div className="min-h-screen bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] lg:block",
            collapsed ? "w-[4.5rem]" : "w-64",
          )}
        >
          <SidebarNav
            collapsed={collapsed}
            onToggleCollapse={toggle}
            showCollapseToggle
          />
        </aside>
        <div
          className={cn(
            "min-h-screen transition-[padding]",
            collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64",
          )}
        >
          <AppHeader onToggleSidebar={toggle} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
