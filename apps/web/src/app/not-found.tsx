import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "No encontrado",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          El recurso solicitado no existe o ya no está disponible.
        </p>
      </div>
    </div>
  );
}
