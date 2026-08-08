import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";

export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyError(error: unknown, fallback: string): void {
  toast.error(getErrorMessage(error, fallback));
}

export function notifyInfo(message: string): void {
  toast.message(message);
}
