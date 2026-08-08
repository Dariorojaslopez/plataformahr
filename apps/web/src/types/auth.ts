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

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  companies: PublicCompany[];
};

export type TokensOnlyResponse = {
  accessToken: string;
  refreshToken: string;
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
