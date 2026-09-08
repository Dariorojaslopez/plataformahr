import { currentCompanyAccessRequest } from "@/lib/api/auth";
import type { CurrentCompanyAccess } from "@/types/auth";

const RETRY_DELAYS_MS = [0, 250, 600] as const;

export async function fetchCompanyAccessWithRetry<T = CurrentCompanyAccess>(
  request: () => Promise<T> = currentCompanyAccessRequest as () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;
  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      return await request();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
