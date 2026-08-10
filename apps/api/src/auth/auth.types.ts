export type AccessTokenPayload = {
  sub: string;
  sid: string;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
  jti: string;
};

export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
};

/**
 * Synthetic membership id used when a Platform Owner enters a tenant
 * without a CompanyMembership. Never accept this value from clients.
 */
export const PLATFORM_OWNER_TENANT_MEMBERSHIP = '__platform_owner__' as const;

export type TenantContext = {
  userId: string;
  companyId: string;
  membershipId: string;
  /** True when access is via Platform Owner bypass (not a real membership). */
  viaPlatformOwner: boolean;
};

export const COMPANY_ID_HEADER = 'x-company-id';

export const AUTH_AUDIT = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGOUT: 'AUTH_LOGOUT',
  REFRESH: 'AUTH_REFRESH',
} as const;
