"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/auth/session-provider";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (
            error &&
            typeof error === "object" &&
            "status" in error &&
            typeof (error as { status: unknown }).status === "number"
          ) {
            const status = (error as { status: number }).status;
            if (status === 401 || status === 403 || status === 404) return false;
          }
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

function TenantCacheBoundary() {
  const { activeCompanyId } = useSession();
  const queryClient = useQueryClient();
  const previousCompanyId = useRef<string | null>(null);

  useEffect(() => {
    if (previousCompanyId.current === activeCompanyId) return;
    if (previousCompanyId.current !== null || activeCompanyId !== null) {
      // Critical: never reuse cached Organization data across tenants.
      queryClient.clear();
    }
    previousCompanyId.current = activeCompanyId;
  }, [activeCompanyId, queryClient]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);

  return (
    <QueryClientProvider client={client}>
      <TenantCacheBoundary />
      {children}
    </QueryClientProvider>
  );
}
