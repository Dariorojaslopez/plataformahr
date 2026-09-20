"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({
  title = "Algo salió mal",
  description = "No pudimos completar la solicitud.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-foreground">{t(title)}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t(description)}
      </p>
      <div className="mt-6 flex items-center gap-3">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            {t("Reintentar")}
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
