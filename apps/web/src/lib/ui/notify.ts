import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";
import { translateUi } from "@/i18n/locale-store";

export function notifySuccess(message: string): void {
  toast.success(translateUi(message));
}

export function notifyError(error: unknown, fallback: string): void {
  toast.error(translateUi(getErrorMessage(error, fallback)));
}

export function notifyInfo(message: string): void {
  toast.message(translateUi(message));
}
