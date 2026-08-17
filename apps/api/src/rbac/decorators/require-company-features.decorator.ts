import { SetMetadata } from '@nestjs/common';
import type { CompanyFeatureCode } from '@talento/shared';

export const REQUIRED_COMPANY_FEATURES_KEY = 'required_company_features';

export const RequireCompanyFeatures = (...features: CompanyFeatureCode[]) =>
  SetMetadata(REQUIRED_COMPANY_FEATURES_KEY, features);
