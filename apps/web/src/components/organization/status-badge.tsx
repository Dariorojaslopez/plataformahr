import { Badge } from "@/components/ui/badge";
import type {
  EmployeeStatus,
  OrganizationEntityStatus,
} from "@/types/organization";

export function OrgStatusBadge({
  status,
}: {
  status: OrganizationEntityStatus | EmployeeStatus;
}) {
  const variant =
    status === "ACTIVE"
      ? "success"
      : status === "TERMINATED"
        ? "destructive"
        : "secondary";
  const label =
    status === "ACTIVE"
      ? "Activo"
      : status === "INACTIVE"
        ? "Inactivo"
        : "Terminado";
  return <Badge variant={variant}>{label}</Badge>;
}
