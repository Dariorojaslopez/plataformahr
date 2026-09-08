"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  changePasswordRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  platformCompaniesRequest,
} from "@/lib/api/auth";
import { refreshAccessToken } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { fetchCompanyAccessWithRetry } from "@/lib/auth/company-access";
import {
  clearSession,
  getAccessToken,
  getActiveCompanyId,
  getSessionCompanies,
  getSessionSnapshot,
  getSessionUser,
  setAccessToken,
  setActiveCompanyId,
  setSessionIdentity,
  subscribeSession,
  type SessionSnapshot,
} from "@/lib/auth/session-store";
import type {
  CurrentCompanyAccess,
  PublicCompany,
  PublicUser,
} from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  companies: PublicCompany[];
  activeCompanyId: string | null;
  activeCompany: PublicCompany | null;
  companyAccess: CurrentCompanyAccess | null;
  companyAccessLoading: boolean;
  companyAccessError: string | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    user: PublicUser;
    companies: PublicCompany[];
  }>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<PublicUser>;
  selectCompany: (companyId: string) => void;
  clearActiveCompany: () => void;
  /** Platform Owner: populate selectable companies from GET /platform/companies */
  setPlatformCompanies: (companies: PublicCompany[]) => void;
  refreshCompanyAccess: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const emptySnapshot: SessionSnapshot = {
  accessToken: null,
  user: null,
  companies: [],
  activeCompanyId: null,
};

function getServerSnapshot(): SessionSnapshot {
  return emptySnapshot;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSnapshot,
  );
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [companyAccess, setCompanyAccess] =
    useState<CurrentCompanyAccess | null>(null);
  const [companyAccessLoading, setCompanyAccessLoading] = useState(false);
  const [companyAccessError, setCompanyAccessError] = useState<string | null>(
    null,
  );
  const accessRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Access token is memory-only; recover via HttpOnly refresh cookie.
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (!cancelled) {
          clearSession();
          setStatus("anonymous");
        }
        return;
      }

      try {
        const me = await meRequest();
        if (cancelled) return;
        let companies = me.companies;
        if (me.isPlatformOwner && companies.length === 0) {
          try {
            companies = await platformCompaniesRequest();
          } catch {
            companies = [];
          }
        }
        setSessionIdentity(me, companies);
        const existingCompany = getActiveCompanyId();
        if (
          existingCompany &&
          companies.some((company) => company.id === existingCompany)
        ) {
          setCompanyAccessLoading(true);
          setActiveCompanyId(existingCompany);
        } else if (companies.length === 1 && !me.isPlatformOwner) {
          setCompanyAccessLoading(true);
          setActiveCompanyId(companies[0].id);
        }
        setStatus("authenticated");
      } catch {
        clearSession();
        if (!cancelled) setStatus("anonymous");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setAccessToken(result.accessToken);
    setSessionIdentity(result.user, result.companies);
    if (result.companies.length === 1) {
      setCompanyAccess(null);
      setCompanyAccessError(null);
      setCompanyAccessLoading(true);
      setActiveCompanyId(result.companies[0].id);
    } else {
      setCompanyAccessError(null);
      setActiveCompanyId(null);
    }
    setStatus("authenticated");
    return { user: result.user, companies: result.companies };
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken() || getSessionUser()) {
        await logoutRequest();
      }
    } catch {
      // always clear local session; server clears cookie on success
    } finally {
      accessRequestId.current += 1;
      setCompanyAccess(null);
      setCompanyAccessError(null);
      setCompanyAccessLoading(false);
      clearSession();
      setStatus("anonymous");
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const result = await changePasswordRequest(currentPassword, newPassword);
      setAccessToken(result.accessToken);
      setSessionIdentity(result.user, getSessionCompanies());
      return result.user;
    },
    [],
  );

  const selectCompany = useCallback((companyId: string) => {
    const list = getSessionCompanies();
    if (!list.some((company) => company.id === companyId)) {
      throw new Error("Company not available for this user");
    }
    setCompanyAccess(null);
    setCompanyAccessError(null);
    setCompanyAccessLoading(true);
    setActiveCompanyId(companyId);
  }, []);

  const clearActiveCompany = useCallback(() => {
    accessRequestId.current += 1;
    setCompanyAccess(null);
    setCompanyAccessError(null);
    setCompanyAccessLoading(false);
    setActiveCompanyId(null);
  }, []);

  const setPlatformCompanies = useCallback((companies: PublicCompany[]) => {
    const currentUser = getSessionUser();
    if (!currentUser?.isPlatformOwner) return;
    setSessionIdentity(currentUser, companies);
  }, []);

  const activeCompany =
    snapshot.companies.find(
      (company) => company.id === snapshot.activeCompanyId,
    ) ?? null;

  const applyAccessResult = useCallback(
    (
      requestId: number,
      result:
        | { ok: true; access: CurrentCompanyAccess }
        | { ok: false; error: unknown },
    ) => {
      if (requestId !== accessRequestId.current) return;
      if (result.ok) {
        setCompanyAccess(result.access);
        setCompanyAccessError(null);
      } else {
        setCompanyAccess(null);
        setCompanyAccessError(
          getErrorMessage(
            result.error,
            "No se pudo cargar el acceso de la compañía.",
          ),
        );
      }
      setCompanyAccessLoading(false);
    },
    [],
  );

  const refreshCompanyAccess = useCallback(async () => {
    if (!getActiveCompanyId()) {
      setCompanyAccess(null);
      setCompanyAccessError(null);
      setCompanyAccessLoading(false);
      return;
    }
    const requestId = ++accessRequestId.current;
    setCompanyAccessLoading(true);
    setCompanyAccessError(null);
    try {
      const access = await fetchCompanyAccessWithRetry();
      applyAccessResult(requestId, { ok: true, access });
    } catch (error) {
      applyAccessResult(requestId, { ok: false, error });
    }
  }, [applyAccessResult]);

  useEffect(() => {
    if (!snapshot.activeCompanyId || status !== "authenticated") {
      return;
    }
    const requestId = ++accessRequestId.current;
    void fetchCompanyAccessWithRetry().then(
      (access) => applyAccessResult(requestId, { ok: true, access }),
      (error: unknown) => applyAccessResult(requestId, { ok: false, error }),
    );
  }, [snapshot.activeCompanyId, status, applyAccessResult]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: snapshot.user,
      companies: snapshot.companies,
      activeCompanyId: snapshot.activeCompanyId,
      activeCompany,
      companyAccess,
      companyAccessLoading,
      companyAccessError,
      login,
      logout,
      changePassword,
      selectCompany,
      clearActiveCompany,
      setPlatformCompanies,
      refreshCompanyAccess,
    }),
    [
      status,
      snapshot.user,
      snapshot.companies,
      snapshot.activeCompanyId,
      activeCompany,
      companyAccess,
      companyAccessLoading,
      companyAccessError,
      login,
      logout,
      changePassword,
      selectCompany,
      clearActiveCompany,
      setPlatformCompanies,
      refreshCompanyAccess,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}

export { getErrorMessage };
