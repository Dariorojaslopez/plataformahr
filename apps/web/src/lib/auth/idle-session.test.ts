import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAST_ACTIVITY_STORAGE_KEY,
  SESSION_IDLE_MS,
  clearLastActivityAt,
  createIdleSessionWatcher,
  isSessionIdle,
  readLastActivityAt,
  remainingIdleMs,
  writeLastActivityAt,
} from "./idle-session";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
  };
}

describe("idle session helpers", () => {
  it("treats a missing timestamp as not idle", () => {
    expect(isSessionIdle(null, Date.now())).toBe(false);
  });

  it("is idle only after three hours", () => {
    const start = Date.parse("2026-09-10T12:00:00.000Z");
    expect(isSessionIdle(start, start + SESSION_IDLE_MS - 1)).toBe(false);
    expect(isSessionIdle(start, start + SESSION_IDLE_MS)).toBe(true);
  });

  it("reads and clears the stored timestamp", () => {
    const storage = memoryStorage();
    writeLastActivityAt(123, storage);
    expect(readLastActivityAt(storage)).toBe(123);
    expect(storage.getItem(LAST_ACTIVITY_STORAGE_KEY)).toBe("123");
    clearLastActivityAt(storage);
    expect(readLastActivityAt(storage)).toBeNull();
  });

  it("computes remaining idle time", () => {
    const start = 1_000;
    expect(remainingIdleMs(start, start + 1_000, 5_000)).toBe(4_000);
    expect(remainingIdleMs(start, start + 9_000, 5_000)).toBe(0);
  });
});

describe("createIdleSessionWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs out when the idle window elapses without activity", () => {
    const storage = memoryStorage();
    const onIdle = vi.fn();
    const stop = createIdleSessionWatcher({
      onIdle,
      storage,
      now: Date.now,
    });

    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SESSION_IDLE_MS + 1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("resets the idle window on user activity", () => {
    const storage = memoryStorage();
    const onIdle = vi.fn();
    const stop = createIdleSessionWatcher({
      onIdle,
      storage,
      now: Date.now,
    });

    vi.advanceTimersByTime(SESSION_IDLE_MS - 60_000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(SESSION_IDLE_MS - 60_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(120_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("logs out immediately when stored activity is already stale", () => {
    const storage = memoryStorage();
    writeLastActivityAt(Date.now() - SESSION_IDLE_MS - 1, storage);
    const onIdle = vi.fn();
    const stop = createIdleSessionWatcher({
      onIdle,
      storage,
      now: Date.now,
    });
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });
});
