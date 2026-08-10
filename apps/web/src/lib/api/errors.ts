export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(
    status: number,
    message: string,
    details?: unknown,
    requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = statusToCode(status);
    this.details = details;
    this.requestId = requestId ?? extractRequestId(details);
  }
}

function extractRequestId(details: unknown): string | null {
  if (
    details &&
    typeof details === "object" &&
    "requestId" in details &&
    typeof (details as { requestId: unknown }).requestId === "string"
  ) {
    return (details as { requestId: string }).requestId;
  }
  return null;
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE";
    default:
      if (status >= 500) return "SERVER_ERROR";
      return "HTTP_ERROR";
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sesión inválida o credenciales incorrectas.";
    if (error.status === 403)
      return "No tienes permisos para realizar esta acción.";
    if (error.status === 404) return "Recurso no encontrado.";
    if (error.status === 409) {
      return (
        error.message ||
        "Conflicto de negocio. Revisa el estado e inténtalo de nuevo."
      );
    }
    if (error.status === 400 || error.status === 422) {
      return error.message || "Solicitud inválida.";
    }
    if (error.status >= 500) {
      const ref = error.requestId
        ? ` Código de referencia: ${error.requestId}.`
        : "";
      return `Error del servidor. Inténtalo más tarde.${ref}`;
    }
    return error.message || fallback;
  }
  if (error instanceof TypeError) {
    return "No se pudo conectar con el servidor.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
