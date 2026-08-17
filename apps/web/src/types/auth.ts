import type {
  CompanyFeatureCode,
  CompanyModuleCode,
} from "@talento/shared";

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformOwner: boolean;
  mustChangePassword?: boolean;
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

export type ManagedCompany = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  membershipCount: number;
  enabledModules: CompanyModuleCode[];
  enabledFeatures: CompanyFeatureCode[];
  initialAdmin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type CreateManagedCompanyInput = {
  name: string;
  legalName?: string;
  slug: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  initialPassword?: string;
  enabledModules: CompanyModuleCode[];
  enabledFeatures: CompanyFeatureCode[];
};

export type CompanyAccess = {
  enabledModules: CompanyModuleCode[];
  enabledFeatures: CompanyFeatureCode[];
};

export type CreateManagedCompanyResponse = {
  company: Pick<ManagedCompany, "id" | "name" | "legalName" | "slug" | "status">;
  initialAdmin: NonNullable<ManagedCompany["initialAdmin"]>;
  temporaryPassword: string;
};

export type ManagedPlatformOwner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED" | "BLOCKED";
  isPlatformOwner: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlatformOwnerInput = {
  firstName: string;
  lastName: string;
  email: string;
};

export type UpdatePlatformOwnerInput = Partial<
  Pick<
    ManagedPlatformOwner,
    "firstName" | "lastName" | "email" | "status" | "isPlatformOwner"
  >
>;

export type CurrentCompanyResponse = {
  id: string;
  name: string;
  slug: string;
  status: string;
  defaultLanguage: string;
};
