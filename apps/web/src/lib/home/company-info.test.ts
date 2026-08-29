import { describe, expect, it } from "vitest";
import {
  fromDatetimeLocalValue,
  hasVisibleCompanyInfo,
  homeInfoScheduleError,
  toDatetimeLocalValue,
} from "@/lib/home/company-info";

describe("company info helpers", () => {
  it("round-trips a datetime-local value", () => {
    const iso = "2026-08-15T14:30:00.000Z";
    const local = toDatetimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocalValue(local)).toBe(
      new Date(local).toISOString(),
    );
  });

  it("rejects unpublication on or before publication", () => {
    expect(
      homeInfoScheduleError("2026-08-10T10:00", "2026-08-10T09:00"),
    ).toMatch(/posterior/);
    expect(homeInfoScheduleError("2026-08-10T10:00", "")).toBeNull();
  });

  it("only shows live content with title and media", () => {
    expect(
      hasVisibleCompanyInfo({
        isLive: true,
        hasMedia: true,
        title: "Cultura",
      }),
    ).toBe(true);
    expect(
      hasVisibleCompanyInfo({
        isLive: false,
        hasMedia: true,
        title: "Cultura",
      }),
    ).toBe(false);
    expect(
      hasVisibleCompanyInfo({ isLive: true, hasMedia: false, title: "Cultura" }),
    ).toBe(false);
  });
});
