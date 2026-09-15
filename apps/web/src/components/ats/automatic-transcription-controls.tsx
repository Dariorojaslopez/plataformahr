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
import {
  joinTranscriptChunks,
  TRANSCRIPT_MAX_CHARS,
} from "@/lib/ats/transcript-text";

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
  const queueRef = useRef<TranscriptPersistQueue<string> | null>(null);
  const segmentIdRef = useRef<string | null>(null);
  const accumulatedRef = useRef("");
  const [status, setStatus] = useState<SpeechSessionStatus>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingChunk, setPendingChunk] = useState<string | null>(null);
  const [pendingFailed, setPendingFailed] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [activeInterviewId, setActiveInterviewId] = useState(interviewId);

  if (activeInterviewId !== interviewId) {
    setActiveInterviewId(interviewId);
    setLiveText("");
    setPartial("");
    setPendingChunk(null);
    setPendingFailed(false);
    setPendingJobId(null);
    setError(null);
    setStatus("idle");
  }

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
    segmentIdRef.current = null;
    accumulatedRef.current = "";

    queueRef.current = new TranscriptPersistQueue<string>({
      maxAttempts: 3,
      persist: async (chunk) => {
        if (!segmentIdRef.current) {
          const existing = await interviewsApi.getTranscript(interviewId);
          const last = [...existing].sort((a, b) => a.sequence - b.sequence).at(
            -1,
          );
          if (last) {
            segmentIdRef.current = last.id;
            accumulatedRef.current = last.text;
          }
        }
        const merged = joinTranscriptChunks(accumulatedRef.current, chunk);
        if (!segmentIdRef.current) {
          const created = await interviewsApi.addTranscriptSegment(interviewId, {
            text: merged,
            kind: "UNCLASSIFIED",
          });
          segmentIdRef.current = created.id;
          accumulatedRef.current = created.text;
          setLiveText(created.text);
          return created;
        }
        const updated = await interviewsApi.updateTranscriptSegment(
          interviewId,
          segmentIdRef.current,
          { text: merged },
        );
        accumulatedRef.current = updated.text;
        setLiveText(updated.text);
        return updated;
      },
      onSuccess: (job) => {
        setPendingJobId((id) => (id === job.id ? null : id));
        setPendingChunk(null);
        setPendingFailed(false);
        handlePersisted();
      },
      onFailure: (job) => {
        setPendingJobId(job.id);
        setPendingFailed(true);
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

  function enqueueFinal(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const job = queueRef.current?.enqueue(trimmed.slice(0, TRANSCRIPT_MAX_CHARS));
    if (job) {
      setPendingJobId(job.id);
      setPendingChunk(trimmed);
      setPendingFailed(false);
      setLiveText(joinTranscriptChunks(accumulatedRef.current, trimmed));
    }
    setPartial("");
  }

  const finalHandlers = {
    onPartialText: (text: string) => setPartial(text),
    onFinalText: (text: string) => enqueueFinal(text),
    onError: (message: string) => {
      setError(message);
      setAnnouncement(message);
    },
    onStatus: (next: SpeechSessionStatus) => setStatus(next),
  };

  async function startListening() {
    const provider = providerRef.current;
    if (!provider || !canUse) return;
    setError(null);
    setAnnouncement("Transcripción iniciada");
    await provider.start(finalHandlers);
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
    await providerRef.current?.resume?.(finalHandlers);
    setAnnouncement("Transcripción reanudada");
  }

  function retryPending() {
    if (!pendingJobId) return;
    setPendingFailed(false);
    void queueRef.current?.retry(pendingJobId);
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
      <p className="text-xs text-muted-foreground">
        Aunque hables con pausas, el texto se concatena en un solo campo de
        transcripción.
      </p>

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

      {liveText || pendingChunk ? (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">
            Texto acumulado (un solo campo)
          </p>
          <p className="whitespace-pre-wrap">
            {liveText || pendingChunk}
          </p>
          {pendingChunk ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingFailed
                ? "Pendiente de guardar (error de red)."
                : "Guardando…"}
            </p>
          ) : null}
          {pendingFailed && pendingJobId ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={retryPending}
            >
              Reintentar
            </Button>
          ) : null}
        </div>
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
