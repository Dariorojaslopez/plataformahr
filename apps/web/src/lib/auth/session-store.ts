import type { PublicCompany, PublicUser } from "@/types/auth";

const COMPANY_ID_KEY = "tsc.activeCompanyId";
const SIDEBAR_KEY = "tsc.sidebarCollapsed";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export type SessionSnapshot = {
  accessToken: string | null;
  user: PublicUser | null;
  companies: PublicCompany[];
  activeCompanyId: string | null;
};

type Listener = () => void;

let accessTokenMemory: string | null = null;
let userMemory: PublicUser | null = null;
let companiesMemory: PublicCompany[] = [];
let activeCompanyIdMemory: string | null = null;
const listeners = new Set<Listener>();

/** Cached for useSyncExternalStore — must be referentially stable between emits. */
let cachedSnapshot: SessionSnapshot = {
  accessToken: null,
  user: null,
  companies: companiesMemory,
  activeCompanyId: null,
};

function resolveActiveCompanyId(): string | null {
  if (activeCompanyIdMemory) return activeCompanyIdMemory;
  if (!canUseSessionStorage()) return null;
  const fromStorage = sessionStorage.getItem(COMPANY_ID_KEY);
  if (fromStorage) {
    activeCompanyIdMemory = fromStorage;
  }
  return fromStorage;
}

function rebuildSnapshot(): void {
  const activeCompanyId = resolveActiveCompanyId();
  if (
    cachedSnapshot.accessToken === accessTokenMemory &&
    cachedSnapshot.user === userMemory &&
    cachedSnapshot.companies === companiesMemory &&
    cachedSnapshot.activeCompanyId === activeCompanyId
  ) {
    return;
  }
  cachedSnapshot = {
    accessToken: accessTokenMemory,
    user: userMemory,
    companies: companiesMemory,
    activeCompanyId,
  };
}

function emit(): void {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function getActiveCompanyId(): string | null {
  return resolveActiveCompanyId();
}

export function getSessionUser(): PublicUser | null {
  return userMemory;
}

export function getSessionCompanies(): PublicCompany[] {
  return companiesMemory;
}

export function getSessionSnapshot(): SessionSnapshot {
  rebuildSnapshot();
  return cachedSnapshot;
}

/** Access token stays in memory only. Refresh lives in HttpOnly cookie. */
export function setAccessToken(accessToken: string): void {
  accessTokenMemory = accessToken;
  emit();
}

/** @deprecated use setAccessToken — kept briefly for call-site migration */
export function setTokens(accessToken: string): void {
  setAccessToken(accessToken);
}

export function setSessionIdentity(
  user: PublicUser,
  companies: PublicCompany[],
): void {
  userMemory = user;
  companiesMemory = companies;
  const currentCompany = getActiveCompanyId();
  if (currentCompany && !companies.some((c) => c.id === currentCompany)) {
    setActiveCompanyId(null);
  }
  emit();
}

export function updateSessionCompany(
  companyId: string,
  patch: Partial<Pick<PublicCompany, "name" | "slug">>,
): void {
  companiesMemory = companiesMemory.map((company) =>
    company.id === companyId ? { ...company, ...patch } : company,
  );
  emit();
}

export function setActiveCompanyId(companyId: string | null): void {
  activeCompanyIdMemory = companyId;
  if (canUseSessionStorage()) {
    if (companyId) sessionStorage.setItem(COMPANY_ID_KEY, companyId);
    else sessionStorage.removeItem(COMPANY_ID_KEY);
  }
  emit();
}

export function clearSession(): void {
  accessTokenMemory = null;
  userMemory = null;
  companiesMemory = [];
  activeCompanyIdMemory = null;
  if (canUseSessionStorage()) {
    sessionStorage.removeItem(COMPANY_ID_KEY);
    // Legacy cleanup if an old tab still has a refresh token key.
    sessionStorage.removeItem("tsc.refreshToken");
  }
  emit();
}

/** UI preference only — not auth/secrets. */
export function getSidebarCollapsed(): boolean {
  if (!canUseLocalStorage()) return false;
  return localStorage.getItem(SIDEBAR_KEY) === "1";
}

export function setSidebarCollapsed(collapsed: boolean): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  emitSidebar();
}

const sidebarListeners = new Set<() => void>();

function emitSidebar(): void {
  for (const listener of sidebarListeners) listener();
}

export function subscribeSidebar(listener: () => void): () => void {
  sidebarListeners.add(listener);
  return () => sidebarListeners.delete(listener);
}

/** Assert auth tokens never touch Web Storage. */
export function assertNoTokenWebStorage(): boolean {
  if (canUseLocalStorage()) {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.toLowerCase().includes("token")) return false;
    }
  }
  if (canUseSessionStorage()) {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key.toLowerCase().includes("token")) return false;
    }
  }
  return true;
}

/** @deprecated alias */
export function assertNoTokenLocalStorage(): boolean {
  return assertNoTokenWebStorage();
}
