import { ApiError } from "@/lib/api/errors";
import {
  clearSession,
  getAccessToken,
  getActiveCompanyId,
  setAccessToken,
} from "@/lib/auth/session-store";
import type { AccessTokenResponse } from "@/types/auth";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  companyId?: string | null;
  skipRefresh?: boolean;
  signal?: AbortSignal;
  /** Include cookies (refresh). Default true for same API origin only. */
  credentials?: RequestCredentials;
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

async function executeFetch(
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  const {
    method = "GET",
    body,
    headers = {},
    auth = true,
    companyId,
    signal,
    credentials = "include",
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

  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials,
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new TypeError("Network request failed");
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, skipRefresh = false } = options;

  const response = await executeFetch(path, options);

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

export type ApiBlobResponse = {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
};

function filenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}

/** Authenticated binary download (keeps Bearer + X-Company-Id). */
export async function apiRequestBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiBlobResponse> {
  const { auth = true, skipRefresh = false } = options;
  const withAccept: ApiRequestOptions = {
    ...options,
    headers: {
      Accept: "text/csv, application/octet-stream, */*",
      ...options.headers,
    },
  };

  const response = await executeFetch(path, withAccept);

  if (response.status === 401 && auth && !skipRefresh) {
    const refreshed = await runSingleFlightRefresh();
    if (refreshed) {
      return apiRequestBlob(path, { ...options, skipRefresh: true });
    }
    clearSession();
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return {
    blob: await response.blob(),
    filename: filenameFromContentDisposition(
      response.headers.get("Content-Disposition"),
    ),
    contentType: response.headers.get("Content-Type"),
  };
}

/** Refresh via HttpOnly cookie (credentials include). No JS-readable refresh token. */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const tokens = await apiRequest<AccessTokenResponse>("/auth/refresh", {
      method: "POST",
      auth: false,
      skipRefresh: true,
      companyId: null,
      credentials: "include",
    });
    setAccessToken(tokens.accessToken);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

registerRefreshHandler(refreshAccessToken);
