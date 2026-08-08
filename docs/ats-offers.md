# ATS — Job Offers (fase 06A)

Oferta laboral formal posterior a entrevistas. **No** incluye Hiring / Employee / filledCount.

## Modelo

`JobOffer` (tabla `job_offers`):

- `UNIQUE(applicationId)` — una oferta formal por Application en v1.
- Salario: `DECIMAL(14,2)` + `salaryCurrency` ISO (default `COP`) + `SalaryPeriod`.
- `OfferEmploymentType`: FULL_TIME | PART_TIME | FIXED_TERM | CONTRACTOR.

## Status / matriz

| From | To |
| --- | --- |
| DRAFT | SENT, WITHDRAWN |
| SENT | ACCEPTED, REJECTED, EXPIRED, WITHDRAWN |
| ACCEPTED / REJECTED / EXPIRED / WITHDRAWN | (terminal) |

## Application integration

- Crear **DRAFT**: Application debe estar en `INTERVIEW`. Application **no** cambia de etapa.
- **SEND**: requiere ≥1 Interview `COMPLETED`. Offer → `SENT`; Application `INTERVIEW` → `OFFER` vía `ApplicationsService.move` (historial + audit).
- **ACCEPT**: Offer → `ACCEPTED`. Application permanece `OFFER`. **No** HIRED, **no** Candidate.HIRED, **no** `filledCount++`, **no** Employee.
- **REJECT**: Offer → `REJECTED`. Application permanece `OFFER` (cierre diferido).
- **WITHDRAW**: desde DRAFT o SENT.

## Interview precondition

- DRAFT: sin entrevista completed.
- SEND: sí requiere Interview COMPLETED (backend enforced).

## Expiration

- Sin cron. `isOfferExpired()` en request.
- Accept sobre SENT con `expiresAt` pasado → 400 y status efectivo `EXPIRED`.

## Concurrency

- `SELECT … FOR UPDATE` + `updateMany` condicionado al status → 409 al perdedor.

## Endpoints

- `POST/GET /ats/applications/:applicationId/offer`
- `GET/PATCH /ats/offers/:id`
- `POST /ats/offers/:id/send|accept|reject|withdraw`

## Who accepts?

No hay Candidate Portal. `accept`/`reject` son **registro administrativo** de RRHH (`ats.offer.respond`).

## RBAC

| Permiso | CLIENT_ADMIN | RECRUITER | LEADER | otros |
| --- | --- | --- | --- | --- |
| `ats.offer.read` | ✓ | ✓ | ✓ | — |
| `ats.offer.manage` | ✓ | ✓ | — | — |
| `ats.offer.respond` | ✓ | ✓ | — | — |

## Audit

`OFFER_CREATED|UPDATED|SENT|ACCEPTED|REJECTED|WITHDRAWN|EXPIRED` — metadata mínima (ids, status). **Sin** salary.

## Multi-tenancy

`companyId` solo TenantContext. Cross-tenant → 404.

## Fuera de 06A

Hiring, Employee, PDF, email, Candidate Portal, STT, reoferta versionada.
