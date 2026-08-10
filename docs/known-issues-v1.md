# Known issues & accepted debt — V1

Classification: **BLOCKER** · **HIGH** · **MEDIUM** · **LOW** · **POST-V1**.
Updated during Release Candidate validation (Fase 13).

## BLOCKER

_None open at RC assessment time (local gates)._

## HIGH

_None unmitigated at RC assessment time._ Residual dependency findings must be re-checked after `pnpm audit --audit-level=high` in the final report.

## MEDIUM

1. **Access JWT not revoked server-side on logout** — valid until TTL after logout; refresh is revoked. Mitigate with short `JWT_ACCESS_TTL`.
2. **Cross-origin SPA cookie topology** — `SameSite=None` + `Secure` required when web/API origins differ; prefer same-origin `/api` proxy (POST-V1 hardening).
3. **GitHub Actions not pinned to commit SHAs** — workflows use version tags (`actions/checkout@v4`, etc.). Acceptable for V1 with Dependabot; pin before high-assurance environments.
4. **Metrics default enabled** — must be network/proxy restricted; misconfiguration could expose process metrics (not secrets/PII by design, still sensitive ops data).
5. **API image size ~800MB** — acceptable for Node+Prisma native deps; further slim packaging is POST-V1.

## LOW

1. Local lab HTTPS not required; cookie Secure behavior differs from real staging hosts.
2. Pagination max is module-constant (`MAX_LIMIT`, typically 100); ensure any new list endpoints adopt the same pattern.
3. Performance smoke is qualitative (no formal load suite in V1).

## POST-V1

1. Whisper local/WASM, diarization, AI features
2. Hosted Grafana/Alertmanager wiring beyond docs
3. Real cloud staging/production provisioning
4. Same-origin Next.js `/api` proxy
5. Broader access-token denylist / session versioning
6. Formal k6/load and chaos drills
