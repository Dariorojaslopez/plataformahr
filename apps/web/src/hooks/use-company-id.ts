"use client";

import { useSession } from "@/components/auth/session-provider";

/** Active company for query keys. Throws if missing in protected org screens. */
export function useCompanyId(): string {
  const { activeCompanyId } = useSession();
  if (!activeCompanyId) {
    throw new Error("Active company is required");
  }
  return activeCompanyId;
}
