export type PersistJob<TPayload> = {
  id: string;
  payload: TPayload;
  attempts: number;
};

export type PersistQueueOptions<TPayload, TResult> = {
  persist: (payload: TPayload) => Promise<TResult>;
  maxAttempts?: number;
  onSuccess?: (job: PersistJob<TPayload>, result: TResult) => void;
  onFailure?: (job: PersistJob<TPayload>, error: unknown) => void;
};

/**
 * Sequential client-only queue for final transcript segments.
 * Survives only for the browser session (no Redis / backend queue).
 */
export class TranscriptPersistQueue<TPayload, TResult = unknown> {
  private queue: PersistJob<TPayload>[] = [];
  private running = false;
  private readonly maxAttempts: number;
  private readonly persist: PersistQueueOptions<TPayload, TResult>["persist"];
  private readonly onSuccess?: PersistQueueOptions<TPayload, TResult>["onSuccess"];
  private readonly onFailure?: PersistQueueOptions<TPayload, TResult>["onFailure"];
  private idSeq = 0;

  constructor(options: PersistQueueOptions<TPayload, TResult>) {
    this.persist = options.persist;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.onSuccess = options.onSuccess;
    this.onFailure = options.onFailure;
  }

  get pending(): PersistJob<TPayload>[] {
    return [...this.queue];
  }

  get size(): number {
    return this.queue.length;
  }

  enqueue(payload: TPayload): PersistJob<TPayload> {
    this.idSeq += 1;
    const job: PersistJob<TPayload> = {
      id: `stt-${this.idSeq}-${Date.now()}`,
      payload,
      attempts: 0,
    };
    this.queue.push(job);
    void this.pump();
    return job;
  }

  async retry(jobId: string): Promise<void> {
    const job = this.queue.find((item) => item.id === jobId);
    if (!job) return;
    job.attempts = 0;
    void this.pump();
  }

  clear(): void {
    this.queue = [];
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue[0];
        if (!job) break;
        if (job.attempts >= this.maxAttempts) {
          // Leave at front until user retries or clears — stop automatic loop.
          break;
        }
        job.attempts += 1;
        try {
          const result = await this.persist(job.payload);
          this.queue.shift();
          this.onSuccess?.(job, result);
        } catch (error) {
          this.onFailure?.(job, error);
          if (job.attempts >= this.maxAttempts) break;
          // brief backoff
          await new Promise((resolve) => setTimeout(resolve, 250 * job.attempts));
        }
      }
    } finally {
      this.running = false;
    }
  }
}
