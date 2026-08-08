"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSyncExternalStore, type ReactNode } from "react";

type EntityEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

function subscribeMobile(callback: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

/** Dialog on desktop, Sheet on small screens. */
export function EntityEditorShell({
  open,
  onOpenChange,
  title,
  children,
}: EntityEditorProps) {
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    () => false,
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-full overflow-y-auto border-border bg-card p-0 text-card-foreground"
        >
          <div className="border-b border-border px-4 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <div className="p-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
