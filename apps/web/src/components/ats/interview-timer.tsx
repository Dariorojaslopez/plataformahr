"use client";

import { useEffect, useState } from "react";

/** UI-only duration from startedAt. No persistence / no a11y live updates each second. */
export function InterviewTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const start = new Date(startedAt).getTime();
  const elapsed = Number.isNaN(start) ? 0 : Math.max(0, now - start);
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

  return (
    <p className="text-sm tabular-nums text-muted-foreground" aria-hidden>
      Duración: {label}
    </p>
  );
}
