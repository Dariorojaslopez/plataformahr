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

export type TenantContext = {
  userId: string;
  companyId: string;
  membershipId: string;
};

export const COMPANY_ID_HEADER = 'x-company-id';

export const AUTH_AUDIT = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGOUT: 'AUTH_LOGOUT',
  REFRESH: 'AUTH_REFRESH',
} as const;
