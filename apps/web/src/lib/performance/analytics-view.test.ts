import { describe, expect, it } from "vitest";
import {
  DISTRIBUTION_BUCKET_LABELS,
  FORBIDDEN_QUALITATIVE_SCORE_LABELS,
  formatAverageScore,
  formatRate,
  snapshotDisplayName,
  sortBreakdownByResultCount,
  submissionProgressLabel,
} from "@/lib/performance/analytics-view";

describe("analytics view helpers", () => {
  it("formats average null and rates", () => {
    expect(formatAverageScore(null)).toBe("—");
    expect(formatAverageScore(85)).toBe("85.00%");
    expect(formatRate(33.33)).toBe("33.33%");
  });

  it("describes SELF/MANAGER submission progress with own denominators", () => {
    expect(
      submissionProgressLabel({ submitted: 2, total: 4, submittedRate: 50 }),
    ).toBe("2 / 4 enviadas (50.00%)");
    expect(
      submissionProgressLabel({ submitted: 0, total: 0, submittedRate: 0 }),
    ).toBe("0 / 0 enviadas (0.00%)");
  });

  it("uses snapshot empty labels", () => {
    expect(snapshotDisplayName(null, "Sin área")).toBe("Sin área");
    expect(snapshotDisplayName({ id: "a", name: "Area A" }, "Sin área")).toBe(
      "Area A",
    );
  });

  it("sorts breakdown by resultCount desc", () => {
    const sorted = sortBreakdownByResultCount([
      { id: "b", name: "B", resultCount: 1, averageScore: 90 },
      { id: "a", name: "A", resultCount: 3, averageScore: 80 },
    ]);
    expect(sorted[0]?.name).toBe("A");
  });

  it("keeps neutral distribution labels without qualitative wording", () => {
    expect(DISTRIBUTION_BUCKET_LABELS).toContain("80–100");
    const joined = DISTRIBUTION_BUCKET_LABELS.join(" ").toLowerCase();
    for (const forbidden of FORBIDDEN_QUALITATIVE_SCORE_LABELS) {
      expect(joined).not.toContain(forbidden);
    }
  });
});
