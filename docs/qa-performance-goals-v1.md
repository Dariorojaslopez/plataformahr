# QA Performance + Goals V1 (09E)

## Alcance auditado

- Performance 08A–08E (ciclos, competencias, escalas, participantes, SELF/MANAGER, resultados, release, analytics, CSV)
- Goals 09A–09C (periodos, goals, KR, check-ins, progress, mine/team, completion, GoalResult)
- Integración 09D (composición, snapshots, overallScore, privacy employee)
- Auth / Tenant / RBAC / AuditLog / Frontend lifecycle UX

## Baseline inicial (pre-fixes 09E)

| Métrica | Valor |
|--------|------:|
| API unit | 120 |
| API e2e | 126 |
| Web tests | 151 |
| Permissions | 44 |
| Roles | 5 |
| lint / build api / build web | verde |
| seed ×2 | idempotente 5/44 |

## Issues encontrados

### HIGH (corregidos)

1. **Privacidad Goals — `latestRejection.reviewComment` en mine/detail**  
   Viewers AREA/COMPANY recibían comentario de rechazo.  
   Fix: `redactRejectionCommentsForViewer` + política en enrich.

2. **Privacidad Goals — `goals.completion.review` demasiado amplio**  
   Leader con permiso de review veía comentarios de AREA/COMPANY que no puede aprobar.  
   Fix: `commentPrivacy` exige manage **o** assignment **o** `canLeaderReviewGoal`.

3. **Frontend — Publicar oculto en ciclo CLOSED**  
   UI acoplaba acciones de resultado a `canAssign` (solo ACTIVE). Backend permite release en CLOSED.  
   Fix: `canMutateParticipantResults` + `canReleaseParticipantResult(cycleStatus)`.

4. **Frontend — Double-submit Goals lifecycle**  
   Activar/Cerrar/Cancelar periodo y Activar/Cancelar goal sin `isPending`.  
   Fix: disabled + copy pending.

5. **Frontend — Lista Goals invisible en móvil**  
   Tabla solo `md:block` sin cards móviles.  
   Fix: cards `md:hidden`.

6. **Frontend — Empty confuso en loading/error**  
   Cycle detail goals y GoalResult COMPLETED.  
   Fix: ramas loading / ErrorState / empty.

### MEDIUM (corregidos / acotados)

7. Mensajes calculate composition en inglés → español.
8. Labels “Objetivos/score” → “Cumplimiento de objetivos” en breakdown/resultados.
9. Término `(GoalResult)` eliminado del mensaje de calculate incompleto.

### HIGH hygiene (corregido en working tree)

10. **`apps/api/.env` estaba trackeado** pese a `.gitignore` raíz.  
    Fix: `git rm --cached apps/api/.env` (archivo local conservado). Requiere commit futuro del usuario para persistir en remoto; rotar secrets de env si el remoto ya los expuso.

### LOW / DEBT (documentados, no bloquean)

- Sheet/Dialog titles accesibles en `EntityEditorShell` (patrón global).
- Badges de status crudos en algunos historiales de reviews.
- Backfill audiencia GoalResult legacy best-effort (09D).
- Sin browser smoke manual en este entorno (cubierto por e2e).
- Fuera de alcance: rankings, 9-box, calibration, PDP, 360, LMS, IA.
- Historial git puede seguir conteniendo `.env` antiguo hasta purge (fuera de 09E).

## Tests agregados

- e2e: `09E privacy: AREA/COMPANY viewers do not receive rejection reviewComment` (suite completion: 2 tests)
- unit web: release en CLOSED / `canMutateParticipantResults`

## Baseline → final

| Métrica | Inicial | Final |
|--------|--------:|------:|
| API unit | 120 | 120 |
| API e2e | 126 | 127 |
| Web tests | 151 | 151 |
| Permissions | 44 | 44 |

## Smoke

| Flow | Cobertura |
|------|-----------|
| A Performance clásico | e2e `performance-results` + integration competency-only |
| B Performance + Goals | e2e `goals-performance-integration` 70/30, snapshots, CSV |
| C Employee | e2e release/privacy my-results; Goals mine |
| D Admin analytics/CSV | e2e analytics + CSV columns 09D |
| E Multi-tenant | e2e cross-tenant 404 en Performance/Goals/09D |

Browser manual: no ejecutado en esta sesión; flujos críticos cubiertos por e2e.

## Limitaciones aceptadas

- No cohortings anónimos / CSV workers / stretch >100 / withdrawal de completion.
- No reescritura global de a11y/WCAG.
- Analytics no introduce rankings.

## Resultado final

Tras correcciones HIGH/MEDIUM acotadas y suites verdes: **PERFORMANCE + GOALS V1: CLOSED**.
