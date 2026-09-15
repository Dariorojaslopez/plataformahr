import { describe, expect, it } from "vitest";
import { joinTranscriptChunks } from "@/lib/ats/transcript-text";

describe("joinTranscriptChunks", () => {
  it("concatenates paused speech into one string", () => {
    expect(joinTranscriptChunks("", "Hola")).toBe("Hola");
    expect(joinTranscriptChunks("Hola", "mundo")).toBe("Hola mundo");
    expect(joinTranscriptChunks("Hola ", "  mundo  ")).toBe("Hola mundo");
  });

  it("respects max length", () => {
    expect(joinTranscriptChunks("abc", "def", 5)).toBe("abc d");
  });
});
