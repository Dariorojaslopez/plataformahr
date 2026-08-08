"use client";

import { Building2, ChevronsUpDown, LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { ThemeToggleButton } from "@/components/theme/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { resolvePageTitle } from "@/lib/navigation";
import { getInitials } from "@/lib/utils";
import { useState } from "react";

type AppHeaderProps = {
  onToggleSidebar?: () => void;
};

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, companies, activeCompany, selectCompany, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Abrir menú">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {onToggleSidebar ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={onToggleSidebar}
          aria-label="Colapsar barra lateral"
        >
          <Menu className="h-4 w-4" />
        </Button>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-foreground">
          {resolvePageTitle(pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {companies.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="max-w-[14rem] gap-2">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate text-xs sm:text-sm">
                  {activeCompany?.name ?? "Compañía"}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Compañías</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onSelect={() => {
                    selectCompany(company.id);
                    router.push("/dashboard");
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{company.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {company.slug}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
              {companies.length > 1 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push("/select-company")}>
                    Ver todas
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <ThemeToggleButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0"
              aria-label="Menú de usuario"
            >
              <Avatar>
                <AvatarFallback>
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.isPlatformOwner ? (
              <DropdownMenuItem onSelect={() => router.push("/platform")}>
                Platform
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => {
                void logout().then(() => router.replace("/login"));
              }}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
