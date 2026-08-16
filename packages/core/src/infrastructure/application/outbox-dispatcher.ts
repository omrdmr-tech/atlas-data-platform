import type {
  OutboxStore,
  PendingOutboxEvent
} from "../ports/outbox.js";
import type { OutboxPublisher } from "../ports/outbox-publisher.js";

export interface OutboxDispatchResult {
  readonly fetched: number;
  readonly published: number;
  readonly failed: number;
}

export interface OutboxDispatcherOptions {
  readonly maxBatchSize?: number;
  readonly pollIntervalMs?: number;
  readonly leaseDurationMs?: number;
  readonly owner?: string;
}

export class OutboxDispatcher {
  private readonly maxBatchSize: number;
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly owner: string;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeDispatch: Promise<unknown> | null = null;
  private stopRequested: Promise<void> | null = null;

  public constructor(
    private readonly store: OutboxStore,
    private readonly publisher: OutboxPublisher,
    options: OutboxDispatcherOptions = {}
  ) {
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.owner = options.owner ?? "outbox-dispatcher";

    if (
      !Number.isInteger(this.maxBatchSize) ||
      this.maxBatchSize <= 0
    ) {
      throw new Error(
        "Outbox maxBatchSize must be a positive integer."
      );
    }

    if (
      !Number.isInteger(this.pollIntervalMs) ||
      this.pollIntervalMs <= 0
    ) {
      throw new Error(
        "Outbox pollIntervalMs must be a positive integer."
      );
    }

    if (
      !Number.isInteger(this.leaseDurationMs) ||
      this.leaseDurationMs <= 0
    ) {
      throw new Error(
        "Outbox leaseDurationMs must be a positive integer."
      );
    }

    if (!this.owner) {
      throw new Error("Outbox dispatcher owner is required.");
    }
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.scheduleNextPoll(0);
  }

  public async stop(): Promise<void> {
    if (!this.running && this.activeDispatch === null) {
      return;
    }

    if (this.stopRequested !== null) {
      return this.stopRequested;
    }

    this.running = false;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.stopRequested = (async () => {
      if (this.activeDispatch !== null) {
        await this.activeDispatch;
      }
    })();

    try {
      await this.stopRequested;
    } finally {
      this.stopRequested = null;
    }
  }

  public async dispatchOnce(): Promise<OutboxDispatchResult> {
    const events = await this.store.claimPending(
      this.owner,
      this.maxBatchSize,
      this.leaseDurationMs
    );

    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.publishAndMark(event);
        published += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      fetched: events.length,
      published,
      failed
    };
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runPoll();
    }, delayMs);
  }

  private async runPoll(): Promise<void> {
    if (!this.running) {
      return;
    }

    const dispatch = this.dispatchOnce();

    this.activeDispatch = dispatch;

    try {
      await dispatch;
    } catch {
      // A polling failure must not terminate the worker.
      // The next poll will retry the operation.
    } finally {
      if (this.activeDispatch === dispatch) {
        this.activeDispatch = null;
      }
    }

    if (this.running) {
      this.scheduleNextPoll(this.pollIntervalMs);
    }
  }

  private async publishAndMark(
    event: PendingOutboxEvent
  ): Promise<void> {
    await this.publisher.publish(event);
    await this.store.markPublished(event.id, this.owner);
  }
}