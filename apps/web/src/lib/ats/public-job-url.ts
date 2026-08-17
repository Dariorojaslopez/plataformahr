export function publicJobUrl(publicId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/jobs/${encodeURIComponent(publicId)}`;
}
