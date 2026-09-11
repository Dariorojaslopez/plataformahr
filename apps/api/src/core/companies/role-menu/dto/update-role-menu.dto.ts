import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  CONFIGURABLE_COMPANY_ROLES,
  ROLE_MENU_CATALOG,
  type ConfigurableCompanyRole,
} from '@talento/shared';

const GRANTABLE_HREFS = ROLE_MENU_CATALOG.map((item) => item.href);

export class UpdateRoleMenuItemDto {
  @IsIn(CONFIGURABLE_COMPANY_ROLES)
  roleCode!: ConfigurableCompanyRole;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(GRANTABLE_HREFS, { each: true })
  hrefs!: string[];
}

export class UpdateRoleMenusDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRoleMenuItemDto)
  roles!: UpdateRoleMenuItemDto[];
}
