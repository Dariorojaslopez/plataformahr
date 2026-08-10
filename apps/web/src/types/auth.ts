export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformOwner: boolean;
};

export type PublicCompany = {
  id: string;
  name: string;
  slug: string;
};

/** Login / session identity response (refresh token is HttpOnly cookie only). */
export type AuthTokensResponse = {
  accessToken: string;
  user: PublicUser;
  companies: PublicCompany[];
};

export type AccessTokenResponse = {
  accessToken: string;
};

export type AuthMeResponse = PublicUser & {
  companies: PublicCompany[];
};

export type PlatformMeResponse = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformOwner: boolean;
};

export type CurrentCompanyResponse = {
  id: string;
  name: string;
  slug: string;
  status: string;
  defaultLanguage: string;
};
