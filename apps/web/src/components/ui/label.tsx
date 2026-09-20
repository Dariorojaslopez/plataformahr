"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

function translateLabelChildren(
  children: React.ReactNode,
  t: (text: string) => string,
): React.ReactNode {
  if (typeof children === "string") return t(children);
  if (Array.isArray(children) && children.every((child) => typeof child === "string")) {
    return t(children.join(""));
  }
  return children;
}

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const t = useT();
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {translateLabelChildren(children, t)}
    </LabelPrimitive.Root>
  );
});
Label.displayName = LabelPrimitive.Root.displayName;
