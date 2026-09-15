import { describe, expect, it } from "vitest";
import { displayDateToIso, isoDateToDisplay } from "@/lib/ats/date-input";

describe("date-input (DD/MM/AAAA)", () => {
  it("converts ISO to display", () => {
    expect(isoDateToDisplay("1990-03-15")).toBe("15/03/1990");
    expect(isoDateToDisplay("")).toBe("");
    expect(isoDateToDisplay("bad")).toBe("");
  });

  it("parses day/month/year to ISO", () => {
    expect(displayDateToIso("15/03/1990")).toBe("1990-03-15");
    expect(displayDateToIso("1/2/2000")).toBe("2000-02-01");
    expect(displayDateToIso("")).toBe("");
  });

  it("rejects invalid calendar dates and formats", () => {
    expect(displayDateToIso("31/02/2020")).toBeNull();
    expect(displayDateToIso("15-03-1990")).toBeNull();
    expect(displayDateToIso("1990/03/15")).toBeNull();
    expect(displayDateToIso("03/15/1990")).toBeNull(); // US MM/DD
  });
});
