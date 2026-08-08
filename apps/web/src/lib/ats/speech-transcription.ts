/**
 * Abstracción mínima para transcripción futura (STT).
 * Fase 05D: solo entrada manual. NO conectar Web Speech / Whisper / cloud.
 *
 * Puntos de conexión posteriores:
 * - Web Speech API (browser)
 * - Whisper local (desktop/client)
 * - Proveedor cloud (sin enviar audio al NestJS)
 *
 * Flujo futuro:
 * Browser/Desktop → audio local → STT → texto segmentado → NestJS API → PostgreSQL
 * El servidor almacena TEXT + metadata, nunca el archivo de audio.
 */

export type SpeechTranscriptionCallbacks = {
  onPartialText?: (text: string) => void;
  onFinalText?: (text: string) => void;
  onError?: (message: string) => void;
};

export interface SpeechTranscriptionProvider {
  readonly id: string;
  isSupported(): boolean;
  start(callbacks: SpeechTranscriptionCallbacks): Promise<void> | void;
  stop(): Promise<void> | void;
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

export function getDefaultSpeechProvider(): SpeechTranscriptionProvider {
  return new ManualTranscriptionProvider();
}

export const AUTOMATIC_TRANSCRIPTION_UNAVAILABLE_MESSAGE =
  "Transcripción automática no configurada";
