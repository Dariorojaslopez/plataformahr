import { describe, expect, it } from "vitest";
import { publicJobUrl } from "@/lib/ats/public-job-url";

describe("publicJobUrl", () => {
  it("uses the configured browser origin and stable public id", () => {
    expect(publicJobUrl("abc_DEF-123", "https://talent.example/")).toBe(
      "https://talent.example/jobs/abc_DEF-123",
    );
  });
});
