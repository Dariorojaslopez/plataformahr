import { SetMetadata } from '@nestjs/common';

export const PLATFORM_OWNER_ONLY_KEY = 'platform_owner_only';

export const PlatformOwnerOnly = () =>
  SetMetadata(PLATFORM_OWNER_ONLY_KEY, true);
