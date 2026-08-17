import { describe, expect, it } from "vitest";
import { ApiError, getErrorMessage } from "@/lib/api/errors";

describe("getErrorMessage", () => {
  it("shows the API Spanish message for duplicate-code 409", () => {
    const error = new ApiError(
      409,
      "Ya existe un área con el código FIN.",
    );
    expect(getErrorMessage(error, "No se pudo guardar el área.")).toBe(
      "Ya existe un área con el código FIN.",
    );
    expect(
      getErrorMessage(
        new ApiError(
          409,
          "Ya existe una unidad de negocio con el código FIN.",
        ),
        "No se pudo guardar.",
      ),
    ).toBe("Ya existe una unidad de negocio con el código FIN.");
  });

  it("falls back when a 409 has an empty message", () => {
    expect(getErrorMessage(new ApiError(409, ""), "fallback")).toBe(
      "Conflicto de negocio. Revisa el estado e inténtalo de nuevo.",
    );
  });
});
