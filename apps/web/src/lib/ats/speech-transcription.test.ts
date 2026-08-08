import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrowserSpeechTranscriptionProvider,
  getAutomaticSpeechProvider,
  getDefaultSpeechProvider,
  getSpeechRecognitionSupport,
  getSttLanguage,
  isSpeechSecureContext,
  mapSpeechRecognitionError,
  ManualTranscriptionProvider,
} from "@/lib/ats/speech-transcription";
import { TranscriptPersistQueue } from "@/lib/ats/transcript-persist-queue";

function mockWindow(options: {
  speech?: boolean;
  webkit?: boolean;
  secure?: boolean;
  hostname?: string;
}) {
  const recognitionInstances: Array<Record<string, unknown>> = [];
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    maxAlternatives = 1;
    onresult: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    start = vi.fn(() => {
      this.onstart?.();
    });
    stop = vi.fn(() => {
      this.onend?.();
    });
    abort = vi.fn(() => {
      this.onend?.();
    });
    constructor() {
      recognitionInstances.push(this as unknown as Record<string, unknown>);
    }
  }

  const win = {
    isSecureContext: options.secure ?? true,
    location: { hostname: options.hostname ?? "localhost" },
    SpeechRecognition: options.speech ? FakeRecognition : undefined,
    webkitSpeechRecognition: options.webkit ? FakeRecognition : undefined,
  } as unknown as Window;

  vi.stubGlobal("window", win);
  return { FakeRecognition, recognitionInstances, win };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("speech feature detection", () => {
  it("detects SpeechRecognition and secure context", () => {
    mockWindow({ speech: true, secure: true, hostname: "app.example.com" });
    const support = getSpeechRecognitionSupport(window);
    expect(support.available).toBe(true);
    expect(support.secureContext).toBe(true);
    expect(support.constructorName).toBe("SpeechRecognition");
  });

  it("allows localhost even if isSecureContext is false", () => {
    expect(isSpeechSecureContext(false, "localhost")).toBe(true);
    expect(isSpeechSecureContext(false, "evil.com")).toBe(false);
  });

  it("reports unsupported browsers", () => {
    mockWindow({ speech: false, webkit: false, secure: true });
    expect(getSpeechRecognitionSupport(window).available).toBe(false);
    expect(getAutomaticSpeechProvider()).toBeNull();
  });
});

describe("error mapping", () => {
  it("maps common recognition errors to Spanish", () => {
    expect(mapSpeechRecognitionError("not-allowed")).toMatch(/micrófono/i);
    expect(mapSpeechRecognitionError("audio-capture")).toMatch(/micrófono/i);
    expect(mapSpeechRecognitionError("network")).toMatch(/no está disponible/i);
  });
});

describe("language", () => {
  it("defaults to es-CO", () => {
    expect(getSttLanguage()).toBe("es-CO");
  });
});

describe("ManualTranscriptionProvider", () => {
  it("remains default and always supported", () => {
    const provider = getDefaultSpeechProvider();
    expect(provider).toBeInstanceOf(ManualTranscriptionProvider);
    expect(provider.isSupported()).toBe(true);
  });
});

describe("BrowserSpeechTranscriptionProvider", () => {
  it("starts and emits final vs interim separately", async () => {
    const { recognitionInstances } = mockWindow({ speech: true, secure: true });
    const provider = new BrowserSpeechTranscriptionProvider();
    expect(provider.isSupported()).toBe(true);

    const partials: string[] = [];
    const finals: string[] = [];
    const statuses: string[] = [];

    await provider.start({
      onPartialText: (t) => partials.push(t),
      onFinalText: (t) => finals.push(t),
      onStatus: (s) => statuses.push(s),
    });

    const recognition = recognitionInstances[0] as {
      onresult: ((ev: unknown) => void) | null;
    };
    recognition.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal: false,
          0: { transcript: "hola parcial", confidence: 0.5 },
          length: 1,
        },
      ],
      length: 1,
    });
    recognition.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: "hola final", confidence: 0.9 },
          length: 1,
        },
      ],
      length: 1,
    });
    // duplicate final ignored
    recognition.onresult?.({
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: "hola final", confidence: 0.9 },
          length: 1,
        },
      ],
      length: 1,
    });

    expect(partials[0]).toContain("hola parcial");
    expect(finals).toEqual(["hola final"]);
    expect(statuses).toContain("listening");

    await provider.stop();
    expect(statuses).toContain("stopped");
  });

  it("rejects insecure non-localhost contexts", async () => {
    mockWindow({ speech: true, secure: false, hostname: "insecure.example" });
    const provider = new BrowserSpeechTranscriptionProvider();
    const errors: string[] = [];
    await provider.start({ onError: (m) => errors.push(m) });
    expect(errors[0]).toMatch(/contexto seguro/i);
  });
});

describe("TranscriptPersistQueue", () => {
  it("persists sequentially and keeps failed jobs for retry", async () => {
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ id: "ok" });

    const failures: string[] = [];
    const successes: string[] = [];
    const queue = new TranscriptPersistQueue<{ text: string }>({
      maxAttempts: 3,
      persist,
      onFailure: (job) => failures.push(job.id),
      onSuccess: (job) => successes.push(job.id),
    });

    const job = queue.enqueue({ text: "uno" });
    await vi.waitFor(() => expect(job.attempts).toBe(3));
    expect(queue.size).toBe(1);
    expect(failures.length).toBeGreaterThan(0);

    await queue.retry(job.id);
    await vi.waitFor(() => expect(queue.size).toBe(0));
    expect(successes).toContain(job.id);
  });

  it("does not drop ordering for multiple finals", async () => {
    const order: string[] = [];
    const queue = new TranscriptPersistQueue<{ text: string }>({
      persist: async (payload) => {
        order.push(payload.text);
        await new Promise((r) => setTimeout(r, 5));
        return payload.text;
      },
    });
    queue.enqueue({ text: "a" });
    queue.enqueue({ text: "b" });
    await vi.waitFor(() => expect(queue.size).toBe(0));
    expect(order).toEqual(["a", "b"]);
  });
});
