/**
 * Minimal DOM typings for Web Speech API (not fully standardized across TS libs).
 * Used only by the browser STT provider — audio never leaves the browser to our API.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onerror:
    | ((this: SpeechRecognitionLike, ev: SpeechRecognitionErrorEventLike) => void)
    | null;
  onnomatch: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void)
    | null;
  onsoundend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
