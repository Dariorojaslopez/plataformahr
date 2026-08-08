# ATS — Hiring (fase 06B)

Contratación transaccional tras `JobOffer ACCEPTED`. Conecta ATS → Organization.

## Modelo

`Hiring` (`hirings`):

- `UNIQUE(applicationId)`, `UNIQUE(jobOfferId)`, `UNIQUE(employeeId)`
- Vínculo explícito: Application ↔ Offer ↔ Employee ↔ Candidate ↔ Vacancy
- `hireDate`, `hiredByUserId`

## Endpoint

- `POST /ats/applications/:applicationId/hire` — body mínimo: `hireDate?`, `businessUnitId?`, `phone?`
- `GET /ats/applications/:applicationId/hiring`

## Preconditions

- Application `OFFER` + `ACTIVE`
- JobOffer `ACCEPTED` de esa Application
- Vacancy `OPEN|PAUSED` y `filledCount < headcount`
- Sin Hiring previo
- Sin Employee activo con el mismo email en la company

## Transaction (única)

1. Lock Application, Offer, Vacancy  
2. Validar  
3. Crear Employee (datos Candidate + Position/Area de Vacancy)  
4. `filledCount += 1` condicional  
5. Candidate → `HIRED`  
6. Application → `HIRED` / `CLOSED` + StageHistory  
7. Crear Hiring  
8. Audit `HIRING_COMPLETED` (+ stage change) post-commit  

Fallo → ROLLBACK completo.

## Generic `/move` → HIRED

**Prohibido.** HIRED solo vía HiringService. Kanban no ofrece HIRED.

## Vacancy capacity

`filledCount++` una vez. **No** auto-cierre de Vacancy cuando se llena (decisión 06B; cierre manual).

## Otras Applications del Candidate

No se cierran automáticamente. Solo esta Application pasa a HIRED.

## Idempotencia

Segundo hire → `409 Application already hired`.

## Concurrent last slot

`FOR UPDATE` + `updateMany` con `filledCount` esperado → un ganador, perdedor 409.

## RBAC

| Permiso | CLIENT_ADMIN | RECRUITER | LEADER |
| --- | --- | --- | --- |
| `ats.hiring.read` | ✓ | ✓ | ✓ |
| `ats.hiring.manage` | ✓ | ✓ | — |

## Audit

`HIRING_COMPLETED` — ids only, sin salary/PII.

## Fuera de alcance

STT, nómina, PDF, onboarding, email, Candidate Portal, queues.
