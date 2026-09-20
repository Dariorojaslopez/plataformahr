import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy } from "@/lib/performance/date-dmy";

describe("isoToDmy", () => {
  it("formats ISO dates as day/month/year", () => {
    expect(isoToDmy("2026-11-30")).toBe("30/11/2026");
    expect(isoToDmy("2026-01-07")).toBe("07/01/2026");
  });

  it("returns empty for blank or invalid ISO", () => {
    expect(isoToDmy("")).toBe("");
    expect(isoToDmy("07/01/2026")).toBe("");
  });
});

describe("dmyToIso", () => {
  it("parses day/month/year with slashes or dashes", () => {
    expect(dmyToIso("30/11/2026")).toBe("2026-11-30");
    expect(dmyToIso("7-1-2026")).toBe("2026-01-07");
    expect(dmyToIso("07.01.2026")).toBe("2026-01-07");
  });

  it("rejects impossible dates and month-first values that are invalid as DMY", () => {
    expect(dmyToIso("31/02/2026")).toBeNull();
    expect(dmyToIso("2026-11-30")).toBeNull();
    expect(dmyToIso("")).toBeNull();
  });
});
