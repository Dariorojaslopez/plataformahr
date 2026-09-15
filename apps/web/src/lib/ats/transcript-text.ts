const TRANSCRIPT_MAX_CHARS = 10_000;

/** Concatenate speech finals into one continuous transcript field. */
export function joinTranscriptChunks(
  existing: string,
  chunk: string,
  maxChars = TRANSCRIPT_MAX_CHARS,
): string {
  const a = existing.trimEnd();
  const b = chunk.trim();
  if (!a) return b.slice(0, maxChars);
  if (!b) return a.slice(0, maxChars);
  return `${a} ${b}`.slice(0, maxChars);
}

export { TRANSCRIPT_MAX_CHARS };
