"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { loginRequest, logoutRequest, meRequest } from "@/lib/api/auth";
import { refreshAccessToken } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import {
  clearSession,
  getActiveCompanyId,
  getRefreshToken,
  getSessionCompanies,
  getSessionSnapshot,
  getSessionUser,
  setActiveCompanyId,
  setSessionIdentity,
  setTokens,
  subscribeSession,
  type SessionSnapshot,
} from "@/lib/auth/session-store";
import type { PublicCompany, PublicUser } from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  companies: PublicCompany[];
  activeCompanyId: string | null;
  activeCompany: PublicCompany | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{
    user: PublicUser;
    companies: PublicCompany[];
  }>;
  logout: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  clearActiveCompany: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const emptySnapshot: SessionSnapshot = {
  accessToken: null,
  refreshToken: null,
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (!cancelled) {
          clearSession();
          setStatus("anonymous");
        }
        return;
      }

      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        if (!cancelled) setStatus("anonymous");
        return;
      }

      try {
        const me = await meRequest();
        if (cancelled) return;
        setSessionIdentity(me, me.companies);
        const existingCompany = getActiveCompanyId();
        if (
          existingCompany &&
          me.companies.some((company) => company.id === existingCompany)
        ) {
          setActiveCompanyId(existingCompany);
        } else if (me.companies.length === 1) {
          setActiveCompanyId(me.companies[0].id);
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
    setTokens(result.accessToken, result.refreshToken);
    setSessionIdentity(result.user, result.companies);
    if (result.companies.length === 1) {
      setActiveCompanyId(result.companies[0].id);
    } else {
      setActiveCompanyId(null);
    }
    setStatus("authenticated");
    return { user: result.user, companies: result.companies };
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getSessionUser()) {
        await logoutRequest();
      }
    } catch {
      // always clear local session
    } finally {
      clearSession();
      setStatus("anonymous");
    }
  }, []);

  const selectCompany = useCallback((companyId: string) => {
    const list = getSessionCompanies();
    if (!list.some((company) => company.id === companyId)) {
      throw new Error("Company not available for this user");
    }
    setActiveCompanyId(companyId);
  }, []);

  const clearActiveCompany = useCallback(() => {
    setActiveCompanyId(null);
  }, []);

  const activeCompany =
    snapshot.companies.find(
      (company) => company.id === snapshot.activeCompanyId,
    ) ?? null;

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: snapshot.user,
      companies: snapshot.companies,
      activeCompanyId: snapshot.activeCompanyId,
      activeCompany,
      login,
      logout,
      selectCompany,
      clearActiveCompany,
    }),
    [
      status,
      snapshot.user,
      snapshot.companies,
      snapshot.activeCompanyId,
      activeCompany,
      login,
      logout,
      selectCompany,
      clearActiveCompany,
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
