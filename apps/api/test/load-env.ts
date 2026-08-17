import { readFileSync } from 'node:fs';

/**
 * Load KEY=VALUE pairs from a local .env if the file exists.
 * Never overrides variables already set (CI injects DATABASE_URL, JWT_*, etc.).
 * Missing file is expected on GitHub Actions — apps/api/.env is gitignored.
 */
export function loadOptionalEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex);
      const value = trimmed.slice(separatorIndex + 1);
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional when the environment already provides the variables.
  }
}
