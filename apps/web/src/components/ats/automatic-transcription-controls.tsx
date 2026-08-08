"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { interviewsApi } from "@/lib/api/interviews";
import {
  AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE,
  BrowserSpeechTranscriptionProvider,
  getAutomaticSpeechProvider,
  getSpeechRecognitionSupport,
  STT_CONSENT_HINT,
  STT_PRIVACY_NOTICE,
  type SpeechSessionStatus,
  type SpeechTranscriptionProvider,
} from "@/lib/ats/speech-transcription";
import { TranscriptPersistQueue } from "@/lib/ats/transcript-persist-queue";
import type { CreateTranscriptSegmentInput } from "@/types/interviews";

type PendingItem = {
  id: string;
  text: string;
  failed: boolean;
};

type Props = {
  interviewId: string;
  interviewStatus: string;
  enabled: boolean;
  onSegmentPersisted: () => void | Promise<void>;
};

export function AutomaticTranscriptionControls({
  interviewId,
  interviewStatus,
  enabled,
  onSegmentPersisted,
}: Props) {
  const providerRef = useRef<SpeechTranscriptionProvider | null>(null);
  const queueRef = useRef<TranscriptPersistQueue<
    CreateTranscriptSegmentInput
  > | null>(null);
  const [status, setStatus] = useState<SpeechSessionStatus>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const support = getSpeechRecognitionSupport();
  const automaticAvailable = Boolean(getAutomaticSpeechProvider());
  const canUse =
    enabled && interviewStatus === "IN_PROGRESS" && automaticAvailable;

  const handlePersisted = useEffectEvent(() => {
    void onSegmentPersisted();
  });

  useEffect(() => {
    const provider = new BrowserSpeechTranscriptionProvider();
    providerRef.current = provider.isSupported() ? provider : null;

    queueRef.current = new TranscriptPersistQueue<CreateTranscriptSegmentInput>({
      maxAttempts: 3,
      persist: (payload) =>
        interviewsApi.addTranscriptSegment(interviewId, payload),
      onSuccess: (job) => {
        setPending((items) => items.filter((item) => item.id !== job.id));
        handlePersisted();
      },
      onFailure: (job) => {
        setPending((items) =>
          items.map((item) =>
            item.id === job.id ? { ...item, failed: true } : item,
          ),
        );
      },
    });

    return () => {
      void providerRef.current?.stop();
      providerRef.current = null;
      queueRef.current?.clear();
      queueRef.current = null;
    };
  }, [interviewId]);

  useEffect(() => {
    if (interviewStatus !== "IN_PROGRESS") {
      void providerRef.current?.stop();
    }
  }, [interviewStatus]);

  async function startListening() {
    const provider = providerRef.current;
    if (!provider || !canUse) return;
    setError(null);
    setAnnouncement("Transcripción iniciada");
    await provider.start({
      onPartialText: (text) => setPartial(text),
      onFinalText: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const job = queueRef.current?.enqueue({
          text: trimmed.slice(0, 10000),
          kind: "UNCLASSIFIED",
        });
        if (job) {
          setPending((items) => [
            ...items,
            { id: job.id, text: trimmed, failed: false },
          ]);
        }
        setPartial("");
      },
      onError: (message) => {
        setError(message);
        setAnnouncement(message);
      },
      onStatus: (next) => setStatus(next),
    });
  }

  async function stopListening() {
    await providerRef.current?.stop();
    setPartial("");
    setAnnouncement("Transcripción detenida");
  }

  async function pauseListening() {
    await providerRef.current?.pause?.();
    setAnnouncement("Transcripción pausada");
  }

  async function resumeListening() {
    await providerRef.current?.resume?.({
      onPartialText: (text) => setPartial(text),
      onFinalText: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const job = queueRef.current?.enqueue({
          text: trimmed.slice(0, 10000),
          kind: "UNCLASSIFIED",
        });
        if (job) {
          setPending((items) => [
            ...items,
            { id: job.id, text: trimmed, failed: false },
          ]);
        }
        setPartial("");
      },
      onError: (message) => setError(message),
      onStatus: (next) => setStatus(next),
    });
    setAnnouncement("Transcripción reanudada");
  }

  function retryPending(id: string) {
    setPending((items) =>
      items.map((item) =>
        item.id === id ? { ...item, failed: false } : item,
      ),
    );
    void queueRef.current?.retry(id);
  }

  if (!enabled) return null;

  if (interviewStatus !== "IN_PROGRESS") {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Transcripción automática</h3>
        <p className="text-sm text-muted-foreground">
          Disponible solo mientras la entrevista esté en curso.
        </p>
      </section>
    );
  }

  if (!support.secureContext) {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Transcripción automática</h3>
        <p className="text-sm text-muted-foreground">
          La transcripción requiere un contexto seguro (HTTPS en producción;
          localhost permitido en desarrollo).
        </p>
      </section>
    );
  }

  if (!automaticAvailable) {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Transcripción automática</h3>
        <p className="text-sm text-muted-foreground">
          {AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE}. Puedes continuar con
          entrada manual.
        </p>
      </section>
    );
  }

  const listening =
    interviewStatus === "IN_PROGRESS" &&
    (status === "listening" || status === "requesting");
  const paused = interviewStatus === "IN_PROGRESS" && status === "paused";
  const displayStatus =
    interviewStatus !== "IN_PROGRESS" && status !== "idle"
      ? "stopped"
      : status;
  const displayPartial =
    interviewStatus === "IN_PROGRESS" ? partial : "";

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Transcripción automática</h3>
        {listening ? (
          <p
            className="text-sm font-medium text-destructive"
            role="status"
            aria-live="polite"
          >
            ● Micrófono activo
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{STT_PRIVACY_NOTICE}</p>
      <p className="text-xs text-muted-foreground">{STT_CONSENT_HINT}</p>

      <p className="text-sm" role="status" aria-live="polite">
        Estado: {statusLabel(displayStatus)}
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <div className="flex flex-wrap gap-2">
        {!listening && !paused ? (
          <Button type="button" size="sm" onClick={() => void startListening()}>
            Iniciar transcripción
          </Button>
        ) : null}
        {listening ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void pauseListening()}
            >
              Pausar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void stopListening()}
            >
              Detener
            </Button>
          </>
        ) : null}
        {paused ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => void resumeListening()}
            >
              Reanudar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void stopListening()}
            >
              Detener
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {displayPartial ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm italic text-muted-foreground">
          [Transcribiendo: {displayPartial}]
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-2">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-dashed border-border px-3 py-2 text-sm"
            >
              <p className="whitespace-pre-wrap">{item.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.failed
                  ? "Pendiente de guardar (error de red)."
                  : "Pendiente de guardar…"}
              </p>
              {item.failed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => retryPending(item.id)}
                >
                  Reintentar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function statusLabel(status: SpeechSessionStatus): string {
  switch (status) {
    case "idle":
      return "Sin iniciar";
    case "requesting":
      return "Solicitando permiso";
    case "listening":
      return "Escuchando";
    case "paused":
      return "Pausada";
    case "stopped":
      return "Detenida";
    case "error":
      return "Error";
    default:
      return status;
  }
}
