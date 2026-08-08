import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "@/lib/ui/safe-url";

describe("safeHttpUrl", () => {
  it("allows http and https URLs", () => {
    expect(safeHttpUrl("https://meet.example.com/room")).toBe(
      "https://meet.example.com/room",
    );
    expect(safeHttpUrl("http://localhost:3000/x")).toBe(
      "http://localhost:3000/x",
    );
  });

  it("rejects javascript, data and other schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for empty or invalid values", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});
