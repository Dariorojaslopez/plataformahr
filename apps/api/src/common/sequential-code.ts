/** Pure numeric company codes, zero-padded to at least 3 digits (001, 002, …). */
export function nextSequentialCode(
  codes: Array<string | null | undefined>,
): string {
  let max = 0;
  for (const code of codes) {
    if (!code) continue;
    if (!/^\d+$/.test(code)) continue;
    const value = Number.parseInt(code, 10);
    if (Number.isSafeInteger(value) && value > max) max = value;
  }
  return String(max + 1).padStart(3, "0");
}
