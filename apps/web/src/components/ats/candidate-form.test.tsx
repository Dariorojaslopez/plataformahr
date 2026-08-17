import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CandidateForm, emptyCandidateForm } from "@/components/ats/candidate-form";

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
});

describe("CandidateForm document type", () => {
  it("renders a select of catalog labels, not a free-text input", async () => {
    const user = userEvent.setup();
    render(
      <CandidateForm
        values={emptyCandidateForm()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(document.getElementById("c-doc-type")).toHaveAttribute(
      "role",
      "combobox",
    );
    expect(document.querySelector("#c-doc-type")).not.toHaveAttribute(
      "type",
      "text",
    );
    expect(document.getElementById("c-doc-num")?.tagName).toBe("INPUT");

    const trigger = document.getElementById("c-doc-type");
    expect(trigger).toBeTruthy();
    await user.click(trigger!);

    expect(
      await screen.findByRole("option", { name: "Cédula de Ciudadanía" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Tarjeta de Identidad" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Cédula de Extranjería" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pasaporte" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ninguno" })).toBeInTheDocument();
  });

  it("keeps document type optional", () => {
    render(
      <CandidateForm
        values={emptyCandidateForm()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(document.getElementById("c-doc-type")).not.toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.queryByText("Tipo documento *")).not.toBeInTheDocument();
  });
});
