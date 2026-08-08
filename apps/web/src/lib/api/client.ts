import { ApiError } from "@/lib/api/errors";
import {
  clearSession,
  getAccessToken,
  getActiveCompanyId,
  getRefreshToken,
  setTokens,
} from "@/lib/auth/session-store";
import type { TokensOnlyResponse } from "@/types/auth";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  companyId?: string | null;
  skipRefresh?: boolean;
  signal?: AbortSignal;
};

const DEFAULT_API_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || DEFAULT_API_URL
  );
}

type RefreshHandler = () => Promise<boolean>;

let refreshHandler: RefreshHandler | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function registerRefreshHandler(handler: RefreshHandler): void {
  refreshHandler = handler;
}

export async function runSingleFlightRefresh(): Promise<boolean> {
  if (!refreshHandler) return false;
  if (!refreshPromise) {
    refreshPromise = refreshHandler().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText || "Request failed";
  let details: unknown;
  try {
    const data: unknown = await response.json();
    details = data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      (typeof (data as { message: unknown }).message === "string" ||
        Array.isArray((data as { message: unknown }).message))
    ) {
      const raw = (data as { message: string | string[] }).message;
      message = Array.isArray(raw) ? raw.join(", ") : raw;
    }
  } catch {
    // non-JSON body
  }
  return new ApiError(response.status, message, details);
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    auth = true,
    companyId,
    skipRefresh = false,
    signal,
  } = options;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const resolvedCompanyId =
    companyId === undefined ? getActiveCompanyId() : companyId;
  if (resolvedCompanyId) {
    requestHeaders["X-Company-Id"] = resolvedCompanyId;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new TypeError("Network request failed");
  }

  if (response.status === 401 && auth && !skipRefresh) {
    const refreshed = await runSingleFlightRefresh();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    clearSession();
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const tokens = await apiRequest<TokensOnlyResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
      skipRefresh: true,
      companyId: null,
    });
    setTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

registerRefreshHandler(refreshAccessToken);
