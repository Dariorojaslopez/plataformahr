export const SESSION_IDLE_MS = 3 * 60 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = "tsc.lastActivityAt";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
] as const;

const WRITE_THROTTLE_MS = 15_000;
const IDLE_CHECK_MS = 60_000;

export function readLastActivityAt(
  storage: Pick<Storage, "getItem"> = localStorage,
): number | null {
  const raw = storage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function writeLastActivityAt(
  at: number,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at));
}

export function clearLastActivityAt(
  storage: Pick<Storage, "removeItem"> = localStorage,
): void {
  storage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
}

export function isSessionIdle(
  lastActivityAt: number | null,
  now: number,
  idleMs: number = SESSION_IDLE_MS,
): boolean {
  if (lastActivityAt == null) return false;
  return now - lastActivityAt >= idleMs;
}

export function remainingIdleMs(
  lastActivityAt: number | null,
  now: number,
  idleMs: number = SESSION_IDLE_MS,
): number {
  if (lastActivityAt == null) return idleMs;
  return Math.max(0, lastActivityAt + idleMs - now);
}

export function createIdleSessionWatcher(options: {
  onIdle: () => void;
  idleMs?: number;
  now?: () => number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): () => void {
  const idleMs = options.idleMs ?? SESSION_IDLE_MS;
  const now = options.now ?? Date.now;
  const storage = options.storage ?? localStorage;
  let stopped = false;
  let fired = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastWriteAt = 0;

  const fire = () => {
    if (stopped || fired) return;
    fired = true;
    options.onIdle();
  };

  const check = () => {
    if (isSessionIdle(readLastActivityAt(storage), now(), idleMs)) {
      fire();
    }
  };

  const armTimer = () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      check();
      if (!fired && !stopped) armTimer();
    }, remainingIdleMs(readLastActivityAt(storage), now(), idleMs) + 1);
  };

  const markActivity = () => {
    if (stopped || fired) return;
    const at = now();
    if (at - lastWriteAt >= WRITE_THROTTLE_MS) {
      writeLastActivityAt(at, storage);
      lastWriteAt = at;
    }
    armTimer();
  };

  const existing = readLastActivityAt(storage);
  if (existing != null && isSessionIdle(existing, now(), idleMs)) {
    fire();
    return () => {
      stopped = true;
    };
  }
  if (existing == null) {
    writeLastActivityAt(now(), storage);
    lastWriteAt = now();
  } else {
    lastWriteAt = existing;
  }

  const onActivity = () => markActivity();
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { capture: true, passive: true });
  }

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      check();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LAST_ACTIVITY_STORAGE_KEY) return;
    if (event.newValue == null) {
      fire();
      return;
    }
    check();
    armTimer();
  };
  window.addEventListener("storage", onStorage);

  armTimer();
  intervalId = setInterval(check, IDLE_CHECK_MS);

  return () => {
    stopped = true;
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (intervalId !== null) clearInterval(intervalId);
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, onActivity, true);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("storage", onStorage);
  };
}
