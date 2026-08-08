# Frontend — Interviews (Phase 05D)

UI de entrevistas, evaluación, plantillas y transcripción textual sobre la API ATS real.

## Alcance

- Listado por Application (`?applicationId=`): **no hay** listado tenant-wide en backend
- Integración en Application detail
- Create / detail / lifecycle (start, complete, cancel)
- Workspace evaluación + transcripción (IN_PROGRESS / COMPLETED)
- Plantillas + agregar preguntas (sin edit/delete de preguntas: limitación API)
- Abstracción STT preparada; **solo** entrada manual

**No incluido:** Speech-to-Text real, MediaRecorder, audio upload, Offer/Hiring.

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

## STT futuro

`SpeechTranscriptionProvider` + `ManualTranscriptionProvider` en `lib/ats/speech-transcription.ts`.

Conexión posterior posible: Web Speech API, Whisper local, cloud — **sin** enviar audio a NestJS.

```text
Browser/Desktop → audio local → STT → texto → NestJS → PostgreSQL
```

Servidor: TEXT + metadata. Nunca el archivo.

`localRecordingName`: solo metadata visible; no `file://`.

## Permissions

Sin endpoint de permissions efectivos. Backend autoridad (`evaluate` / `transcribe` + interviewer o CLIENT_ADMIN).

## Responsive

Desktop: dos paneles. Mobile: tabs Evaluación / Transcripción.
