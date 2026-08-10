/**
 * Speech transcription abstraction.
 *
 * Audio NEVER goes to NestJS / PostgreSQL / VPS storage.
 * Only finalized text segments are POSTed to the existing transcript API.
 *
 * Browser SpeechRecognition may use vendor cloud services depending on the
 * browser — we do NOT claim "fully local processing". We DO claim:
 * Talento does not store interview audio on the server.
 */

export type SpeechSessionStatus =
  | "idle"
  | "requesting"
  | "listening"
  | "paused"
  | "stopped"
  | "error";

export type SpeechTranscriptionCallbacks = {
  onPartialText?: (text: string) => void;
  onFinalText?: (text: string) => void;
  onError?: (message: string) => void;
  onStatus?: (status: SpeechSessionStatus) => void;
};

export interface SpeechTranscriptionProvider {
  readonly id: string;
  isSupported(): boolean;
  start(callbacks: SpeechTranscriptionCallbacks): Promise<void> | void;
  stop(): Promise<void> | void;
  pause?(): Promise<void> | void;
  resume?(callbacks: SpeechTranscriptionCallbacks): Promise<void> | void;
}

export type SpeechRecognitionSupport = {
  available: boolean;
  secureContext: boolean;
  constructorName: "SpeechRecognition" | "webkitSpeechRecognition" | null;
};

const DEFAULT_LANGUAGE = "es-CO";
const MAX_AUTO_RESTARTS = 8;

export function getSttLanguage(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_STT_LANGUAGE) {
    const value = process.env.NEXT_PUBLIC_STT_LANGUAGE.trim();
    if (value) return value;
  }
  return DEFAULT_LANGUAGE;
}

export function isLikelyLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function isSpeechSecureContext(
  isSecureContext: boolean,
  hostname: string,
): boolean {
  return isSecureContext || isLikelyLocalhostHost(hostname);
}

export function getSpeechRecognitionSupport(
  win: Window | undefined = typeof window !== "undefined" ? window : undefined,
): SpeechRecognitionSupport {
  if (!win) {
    return { available: false, secureContext: false, constructorName: null };
  }
  const secure = isSpeechSecureContext(
    Boolean(win.isSecureContext),
    win.location?.hostname ?? "",
  );
  if (typeof win.SpeechRecognition === "function") {
    return {
      available: true,
      secureContext: secure,
      constructorName: "SpeechRecognition",
    };
  }
  if (typeof win.webkitSpeechRecognition === "function") {
    return {
      available: true,
      secureContext: secure,
      constructorName: "webkitSpeechRecognition",
    };
  }
  return { available: false, secureContext: secure, constructorName: null };
}

export function mapSpeechRecognitionError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "No se concedió acceso al micrófono.";
    case "audio-capture":
      return "No se detectó un micrófono disponible.";
    case "no-speech":
      return "No se detectó habla. Puedes reintentar.";
    case "network":
      return "El servicio de transcripción no está disponible.";
    case "aborted":
      return "Transcripción interrumpida.";
    default:
      return "No se pudo continuar la transcripción automática.";
  }
}

function getRecognitionConstructor(
  win: Window,
): SpeechRecognitionConstructor | null {
  if (typeof win.SpeechRecognition === "function") return win.SpeechRecognition;
  if (typeof win.webkitSpeechRecognition === "function") {
    return win.webkitSpeechRecognition;
  }
  return null;
}

/** Provider manual: no captura audio; la UI usa textarea. */
export class ManualTranscriptionProvider implements SpeechTranscriptionProvider {
  readonly id = "manual";

  isSupported(): boolean {
    return true;
  }

  start(): void {
    // Sin STT: la captura es manual en UI.
  }
  stop(): void {
    // noop
  }
}

/**
 * Browser Web Speech API provider.
 * Does not upload audio to our backend.
 */
export class BrowserSpeechTranscriptionProvider
  implements SpeechTranscriptionProvider
{
  readonly id = "browser-speech";
  private recognition: SpeechRecognitionLike | null = null;
  private callbacks: SpeechTranscriptionCallbacks | null = null;
  private userStopped = false;
  private paused = false;
  private listening = false;
  private autoRestarts = 0;
  private lastFinalKey = "";
  private status: SpeechSessionStatus = "idle";

  isSupported(): boolean {
    const support = getSpeechRecognitionSupport();
    return support.available && support.secureContext;
  }

  async start(callbacks: SpeechTranscriptionCallbacks): Promise<void> {
    if (typeof window === "undefined") {
      callbacks.onError?.("Entorno no compatible con transcripción automática.");
      return;
    }
    const support = getSpeechRecognitionSupport(window);
    if (!support.secureContext) {
      callbacks.onError?.(
        "La transcripción requiere un contexto seguro (HTTPS o localhost).",
      );
      this.setStatus("error", callbacks);
      return;
    }
    const Ctor = getRecognitionConstructor(window);
    if (!Ctor) {
      callbacks.onError?.(
        "Transcripción automática no disponible en este navegador.",
      );
      this.setStatus("error", callbacks);
      return;
    }

    this.stopInternal(false);
    this.callbacks = callbacks;
    this.userStopped = false;
    this.paused = false;
    this.autoRestarts = 0;
    this.lastFinalKey = "";
    this.setStatus("requesting", callbacks);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSttLanguage();
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.listening = true;
      this.setStatus("listening", this.callbacks);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          const key = text.toLowerCase();
          if (key === this.lastFinalKey) continue;
          this.lastFinalKey = key;
          this.callbacks?.onFinalText?.(text);
          this.callbacks?.onPartialText?.("");
        } else {
          interim += `${text} `;
        }
      }
      if (interim.trim()) {
        this.callbacks?.onPartialText?.(interim.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === "aborted" && this.userStopped) return;
      if (event.error === "no-speech" && this.listening && !this.userStopped) {
        // Common on continuous sessions; allow auto-restart path via onend.
        return;
      }
      const message = mapSpeechRecognitionError(event.error);
      this.callbacks?.onError?.(message);
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        this.userStopped = true;
        this.listening = false;
        this.setStatus("error", this.callbacks);
      }
    };

    recognition.onend = () => {
      this.listening = false;
      if (this.userStopped || this.paused) {
        if (this.paused) this.setStatus("paused", this.callbacks);
        else this.setStatus("stopped", this.callbacks);
        return;
      }
      if (this.autoRestarts >= MAX_AUTO_RESTARTS) {
        this.callbacks?.onError?.(
          "La sesión de transcripción se detuvo demasiado veces. Inicia de nuevo.",
        );
        this.setStatus("error", this.callbacks);
        return;
      }
      this.autoRestarts += 1;
      try {
        recognition.start();
      } catch {
        this.setStatus("stopped", this.callbacks);
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.setStatus("error", callbacks);
      callbacks.onError?.(
        "No se pudo iniciar la transcripción automática.",
      );
    }
  }

  async pause(): Promise<void> {
    if (!this.recognition) return;
    this.paused = true;
    this.listening = false;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this.setStatus("paused", this.callbacks);
  }

  async resume(callbacks?: SpeechTranscriptionCallbacks): Promise<void> {
    if (callbacks) this.callbacks = callbacks;
    if (!this.recognition || !this.callbacks) {
      if (this.callbacks) await this.start(this.callbacks);
      return;
    }
    this.paused = false;
    this.userStopped = false;
    this.setStatus("requesting", this.callbacks);
    try {
      this.recognition.start();
    } catch {
      // Already started or ended — recreate
      await this.start(this.callbacks);
    }
  }

  async stop(): Promise<void> {
    this.stopInternal(true);
  }

  private stopInternal(emitStopped: boolean): void {
    this.userStopped = true;
    this.paused = false;
    this.listening = false;
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
    }
    if (emitStopped) {
      this.setStatus("stopped", this.callbacks);
      this.callbacks?.onPartialText?.("");
    }
  }

  private setStatus(
    status: SpeechSessionStatus,
    callbacks: SpeechTranscriptionCallbacks | null,
  ): void {
    this.status = status;
    callbacks?.onStatus?.(status);
  }
}

export function getAutomaticSpeechProvider(): SpeechTranscriptionProvider | null {
  const browser = new BrowserSpeechTranscriptionProvider();
  return browser.isSupported() ? browser : null;
}

/** Default remains manual for form entry; automatic uses getAutomaticSpeechProvider. */
export function getDefaultSpeechProvider(): SpeechTranscriptionProvider {
  return new ManualTranscriptionProvider();
}

export const AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE =
  "Transcripción automática no disponible en este navegador";

export const STT_PRIVACY_NOTICE =
  "Al iniciar la transcripción, el navegador utilizará el micrófono. La plataforma guardará únicamente el texto transcrito. Talento no almacena el audio en el servidor.";

export const STT_CONSENT_HINT =
  "Asegúrate de contar con la autorización correspondiente antes de transcribir la entrevista.";
