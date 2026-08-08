import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("LoginForm password URL safety", () => {
  it("declares method=post so native submit cannot leak password in the query string", () => {
    const source = readFileSync(
      join(__dirname, "../../components/auth/login-form.tsx"),
      "utf8",
    );
    expect(source).toMatch(/method=["']post["']/);
    expect(source).toMatch(/event\.preventDefault\(\)/);
  });
});
