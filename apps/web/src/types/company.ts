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
