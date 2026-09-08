import { describe, expect, it } from "vitest";
import { forcedThemeForPath } from "./theme";

describe("forcedThemeForPath", () => {
  it("forces light on login and forgot-password only", () => {
    expect(forcedThemeForPath("/login")).toBe("light");
    expect(forcedThemeForPath("/forgot-password")).toBe("light");
    expect(forcedThemeForPath("/dashboard")).toBeUndefined();
    expect(forcedThemeForPath("/ats/pipeline")).toBeUndefined();
  });
});
