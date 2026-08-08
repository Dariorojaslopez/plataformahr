/**
 * Frontend Organization module notes (Phase 05B)
 *
 * ## Permissions UX limitation
 *
 * The API does not currently expose effective membership permissions
 * (e.g. `organization.manage`) to the frontend. JWT payloads only carry
 * identity/session claims.
 *
 * Therefore manage actions (create/edit/reporting) are shown in the UI for
 * users who can access Organization screens. The backend remains authoritative:
 * manage calls without permission return 403 and the UI surfaces a clear error.
 *
 * Do not assume CLIENT_ADMIN is the only manage role — seed assignment may change.
 *
 * ## Employee list enrichment
 *
 * `GET /organization/employees` returns Employee rows with foreign keys only
 * (`areaId`, `positionId`, `businessUnitId`). Area/Position/BU names are resolved
 * client-side from the corresponding list endpoints (no invented backend joins).
 */
export {};
