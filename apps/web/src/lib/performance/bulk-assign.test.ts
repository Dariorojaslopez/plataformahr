import { describe, expect, it } from "vitest";
import { buildBulkAssignPayload } from "@/lib/performance/bulk-assign";

describe("bulk assign payload", () => {
  it("builds employeeIds body and dedupes preserving order", () => {
    expect(buildBulkAssignPayload(["a", "b", "a", "", "c"])).toEqual({
      employeeIds: ["a", "b", "c"],
    });
  });
});
