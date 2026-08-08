import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  soon?: boolean;
  className?: string;
};

export function StatCard({
  title,
  description,
  href,
  icon: Icon,
  soon = false,
  className,
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && !soon ? "hover:border-primary/40" : "",
        soon ? "opacity-80" : "",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="rounded-md bg-muted p-2 text-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        {soon ? <Badge variant="secondary">Próximamente</Badge> : null}
      </CardContent>
    </Card>
  );

  if (!href || soon) return content;
  return (
    <Link href={href} className="block focus-visible:outline-none">
      {content}
    </Link>
  );
}
