# Frontend — Interviews (Phase 05D)

UI de entrevistas, evaluación, plantillas y transcripción textual sobre la API ATS real.

## Alcance

- Listado por Application (`?applicationId=`): **no hay** listado tenant-wide en backend
- Integración en Application detail
- Create / detail / lifecycle (start, complete, cancel)
- Workspace evaluación + transcripción (IN_PROGRESS / COMPLETED)
- Plantillas + agregar preguntas (sin edit/delete de preguntas: limitación API)
- Abstracción STT + transcripción automática browser (Fase 07)

**No incluido:** Whisper server, audio upload, diarización, AI summary.

## API layer

`apps/web/src/lib/api/interviews.ts` (`interviewsApi` + `interviewKeys`).

Keys bajo prefijo `["ats", companyId, "interviews", …]` para aislar tenant junto a `TenantCacheBoundary`.

## Snapshot

Al crear con `templateId`, el backend copia preguntas a `InterviewQuestion`. La UI no edita el snapshot.

## Evaluación

`PUT …/questions/:questionId/answer` con payload según tipo (TEXT/TEXTAREA/RATING/YES_NO).

Guardado explícito por pregunta. Respuestas de otros `answeredByUserId` en solo lectura.

No editable en `COMPLETED` / `CANCELLED`.

## Transcripción

Segmentos ordenados por `sequence` del backend. Create **no** envía `sequence`.

Kinds: Pregunta / Respuesta / Nota / Sin clasificar.

## STT (Fase 07)

- Manual: siempre disponible.
- Automático: `BrowserSpeechTranscriptionProvider` (Web Speech API) cuando el navegador lo soporta.
- Solo Interview `IN_PROGRESS`. Solo texto final se persiste (`UNCLASSIFIED`).
- **Sin audio en el servidor.** Ver [docs/stt.md](stt.md).

`localRecordingName`: solo metadata visible; no `file://`.

## Permissions

Sin endpoint de permissions efectivos. Backend autoridad (`evaluate` / `transcribe` + interviewer o CLIENT_ADMIN).

## Responsive

Desktop: dos paneles. Mobile: tabs Evaluación / Transcripción.
