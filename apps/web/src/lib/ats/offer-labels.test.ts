import { describe, expect, it } from "vitest";
import {
  formatMoney,
  isOfferExpiredClient,
} from "@/lib/ats/offer-labels";
import { offerKeys } from "@/lib/api/offers";

describe("formatMoney", () => {
  it("formats COP without hardcoding $ alone", () => {
    const formatted = formatMoney("4500000", "COP");
    expect(formatted).toMatch(/4.?500.?000/);
    expect(formatted.toUpperCase()).toContain("COP");
  });

  it("handles empty values", () => {
    expect(formatMoney(null, "COP")).toBe("—");
    expect(formatMoney(undefined, "USD")).toBe("—");
  });
});

describe("isOfferExpiredClient", () => {
  it("detects past expiresAt on SENT", () => {
    expect(
      isOfferExpiredClient("SENT", new Date(Date.now() - 1000).toISOString()),
    ).toBe(true);
    expect(
      isOfferExpiredClient("SENT", new Date(Date.now() + 60_000).toISOString()),
    ).toBe(false);
    expect(isOfferExpiredClient("DRAFT", new Date(0).toISOString())).toBe(
      false,
    );
  });
});

describe("offerKeys tenant isolation", () => {
  it("scopes keys by companyId", () => {
    expect(offerKeys.byApplication("a", "app1")[1]).toBe("a");
    expect(offerKeys.byApplication("b", "app1")[1]).toBe("b");
    expect(offerKeys.detail("a", "o1")).not.toEqual(offerKeys.detail("b", "o1"));
  });
});
