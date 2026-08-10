# Speech-to-Text (STT) — Fase 07

Transcripción automática durante entrevistas con micrófono del navegador.

## Arquitectura

```
Browser micrófono
   → SpeechRecognition (motor del navegador)
   → texto interim (solo UI)
   → texto final
   → cola cliente
   → POST /ats/interviews/:id/transcript/segments
   → PostgreSQL (texto + metadata)
```

**El VPS / NestJS / PostgreSQL NUNCA reciben audio.**

Abstracción: `SpeechTranscriptionProvider` en `apps/web/src/lib/ats/speech-transcription.ts`.

| Provider | Rol |
| --- | --- |
| `ManualTranscriptionProvider` | Entrada manual (default, siempre disponible) |
| `BrowserSpeechTranscriptionProvider` | Web Speech API / webkit |

Sustituible a futuro por Whisper local/WASM o cloud **sin** enviar audio a NestJS.

## Motor actual

`BrowserSpeechTranscriptionProvider` usa `SpeechRecognition` / `webkitSpeechRecognition`.

**Privacidad:** el navegador puede procesar audio vía servicios del fabricante.  
**Garantía de producto:** Talento no almacena audio en el servidor.

## Compatibilidad

Feature detection (`getSpeechRecognitionSupport`), no user-agent sniffing.

Requiere contexto seguro: HTTPS (prod) o localhost (dev).

## Idioma

`NEXT_PUBLIC_STT_LANGUAGE` (default `es-CO`).

## Ciclo de vida

STT solo en Interview `IN_PROGRESS`. Stop/cleanup en unmount, complete/cancel o cambio de status.

## Persistencia

Solo resultados **finales** → kind `UNCLASSIFIED`.  
Interim nunca va a DB.  
Cola secuencial cliente + retry limitado + dedupe de finales repetidos.

## Manual

El transcript manual sigue 100% funcional si STT no está soportado.

## Limitaciones

- Sin diarización / clasificación automática QUESTION/ANSWER
- Sin Whisper server / OpenAI / cloud propio
- Sin upload de audio
- Auto-restart limitado (sesiones browser que terminan solas)
