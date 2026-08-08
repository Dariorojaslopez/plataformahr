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
export declare const COMPANY_ID_HEADER = "x-company-id";
export declare const AUTH_AUDIT: {
    readonly LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS";
    readonly LOGOUT: "AUTH_LOGOUT";
    readonly REFRESH: "AUTH_REFRESH";
};
