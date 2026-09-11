export type CompanyBranding = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  brandPrimaryColor: string | null;
  hasLogo: boolean;
  logoUpdatedAt: string | null;
};

export type UpdateCompanyBrandingInput = {
  name?: string;
  brandPrimaryColor?: string | null;
};

export type RoleMenuCatalogItem = {
  section: string;
  href: string;
  label: string;
};

export type RoleMenuRoleConfig = {
  roleCode: "RECRUITER" | "PERFORMANCE_MANAGER" | "LEADER" | "COLLABORATOR";
  hrefs: string[];
  customized: boolean;
};

export type RoleMenuConfig = {
  roles: RoleMenuRoleConfig[];
  catalog: RoleMenuCatalogItem[];
};

export type UpdateRoleMenusInput = {
  roles: Array<{
    roleCode: RoleMenuRoleConfig["roleCode"];
    hrefs: string[];
  }>;
};
