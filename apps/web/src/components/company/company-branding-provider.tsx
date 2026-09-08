"use client";

import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/components/auth/session-provider";
import { companyApi, companyKeys } from "@/lib/api/company";
import {
  brandCssVars,
  companyInitials,
} from "@/lib/company/brand-tokens";
import type { CompanyBranding } from "@/types/company";

export type CompanyBrandingView = {
  companyId: string | null;
  name: string;
  legalName: string | null;
  initials: string;
  brandPrimaryColor: string | null;
  hasLogo: boolean;
  logoSrc: string | null;
  branding: CompanyBranding | null;
};

const CompanyBrandingContext = createContext<CompanyBrandingView | null>(null);

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const { activeCompanyId, activeCompany } = useSession();
  const { resolvedTheme } = useTheme();

  const brandingQuery = useQuery({
    queryKey: companyKeys.branding(activeCompanyId ?? "none"),
    queryFn: () => companyApi.getBranding(),
    enabled: Boolean(activeCompanyId),
  });

  const branding = brandingQuery.data ?? null;
  const logoQuery = useQuery({
    queryKey: companyKeys.logo(
      activeCompanyId ?? "none",
      branding?.logoUpdatedAt ?? null,
    ),
    queryFn: async () => {
      const { blob } = await companyApi.getLogoBlob();
      return blob;
    },
    enabled: Boolean(activeCompanyId && branding?.hasLogo),
    staleTime: Infinity,
  });

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!logoQuery.data) {
      setLogoSrc(null);
      return;
    }
    const url = URL.createObjectURL(logoQuery.data);
    setLogoSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [logoQuery.data]);

  const name = branding?.name ?? activeCompany?.name ?? "Talentgrowthos";
  const view: CompanyBrandingView = {
    companyId: activeCompanyId,
    name,
    legalName: branding?.legalName ?? null,
    initials: companyInitials(name),
    brandPrimaryColor: branding?.brandPrimaryColor ?? null,
    hasLogo: Boolean(branding?.hasLogo),
    logoSrc: branding?.hasLogo ? logoSrc : null,
    branding,
  };

  const style = brandCssVars(view.brandPrimaryColor, {
    dark: resolvedTheme === "dark",
  });

  return (
    <CompanyBrandingContext.Provider value={view}>
      <div
        key={activeCompanyId ?? "none"}
        data-testid="company-branding-root"
        className="min-h-screen"
        style={style}
      >
        {children}
      </div>
    </CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBrandingView {
  const context = useContext(CompanyBrandingContext);
  if (!context) {
    throw new Error("useCompanyBranding must be used within CompanyBrandingProvider");
  }
  return context;
}
