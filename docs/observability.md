# Observability (Fase 12)

Operational visibility without installing Grafana/Prometheus server/Sentry yet.

## Signals

| Signal | Endpoint / channel | Notes |
|--------|-------------------|--------|
| Liveness | `GET /health` | Process up; no DB |
| Readiness | `GET /ready` | DB `SELECT 1` → 200/503 |
| Metrics | `GET /metrics` | Prometheus text; disable with `METRICS_ENABLED=false` |
| Logs | stdout/stderr JSON (prod) | Structured; redacts sensitive keys |

Keep `/health`, `/ready`, `/metrics` separate.

## Structured logging

- Production default: JSON lines (`LOG_FORMAT` defaults to json when `NODE_ENV=production`)
- Level: `LOG_LEVEL` (default `info`)
- Fields: `timestamp`, `level`, `message`, `service`, `environment`, optional `requestId`, `method`, `path`, `statusCode`, `durationMs`
- **Never** log bodies, Authorization, Cookie, tokens, passwords, transcripts, salaries, evaluation comments

Redaction helper strips known sensitive object keys if accidentally passed.

### Slow requests

`SLOW_REQUEST_MS` (default `1000`) logs HTTP requests at `warn` when exceeded.

## Request ID

- Header: `X-Request-Id`
- Valid: printable ASCII, length 8–128, no whitespace
- Invalid/missing → server generates UUID
- Echoed on every response
- Included on error JSON as `requestId` when available
- Frontend `ApiError.requestId` + reference text on 5xx user messages

## Metrics

Library: `prom-client`.

- Default Node metrics (process/memory/event loop)
- `http_requests_total{method,route,status_code}`
- `http_request_duration_seconds` histogram

**Cardinality:** prefer Express route templates (`/employees/:id`); fallback collapses UUIDs/numeric IDs. **No** `userId`/`companyId` labels.

### Exposure

Treat `/metrics` as **internal**. Nginx example denies public `/metrics`. Prefer private network / scrape agent. Not a public product API.

## AuditLog vs operational logs

| | AuditLog (DB) | Operational logs |
|--|---------------|------------------|
| Purpose | Who did what (business) | Health, latency, errors |
| Retention | Business/compliance (future policy) | Platform log retention |
| Content | Domain actions, no secrets | requestId, status, duration |

Do not mix.

## PII policy (never log)

Authorization, Cookie, Set-Cookie, password, JWT, refresh token, salary, transcripts, evaluation responses/comments, Goal check-in comments/evidence, document numbers, unnecessary emails/PII.

## Future alerts (design only)

| Alert | Severity |
|-------|----------|
| API unavailable / restart loop | P1 |
| `/ready` failing | P1 |
| Postgres unavailable | P1 |
| Elevated 5xx rate | P1/P2 |
| Elevated latency (p95) | P2 |
| Backup/migration failure | P1/P2 |
| Volume near capacity | P2 |
| Disk pressure | P2/P3 |

### SLI/SLO candidates (not contractual)

- Availability (successful non-5xx / total) — candidate 99.5% monthly lab target  
- Error rate (5xx) — candidate &lt; 1%  
- Latency p95 — candidate &lt; 1s for interactive APIs  
- Readiness — continuously true outside planned maintenance  

## Future dashboard (not installed)

Request rate, error rate, p50/p95 latency, memory, CPU, event loop, readiness, Postgres availability.

## Log retention

Containers write stdout/stderr only. Retention is a platform decision (future collector). No on-disk app log files.

## Troubleshooting

1. Grab `X-Request-Id` / `requestId` from client error  
2. Search structured logs for that id  
3. Check `/ready` then `/metrics` (privately)  
4. Confirm DB and migration status  

OpenTelemetry full tracing is **out of scope**; requestId is the bridge.
