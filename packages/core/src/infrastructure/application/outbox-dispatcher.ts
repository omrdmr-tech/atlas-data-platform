import type { OutboxStore, PendingOutboxEvent } from "../ports/outbox.js";
import type { OutboxPublisher } from "../ports/outbox-publisher.js";

export interface OutboxDispatchResult {
  readonly fetched: number;
  readonly published: number;
  readonly failed: number;
}

export interface OutboxDispatcherOptions {
  readonly maxBatchSize?: number;
}

export class OutboxDispatcher {
  private readonly maxBatchSize: number;

  public constructor(
    private readonly store: OutboxStore,
    private readonly publisher: OutboxPublisher,
    options: OutboxDispatcherOptions = {}
  ) {
    this.maxBatchSize = options.maxBatchSize ?? 100;

    if (!Number.isInteger(this.maxBatchSize) || this.maxBatchSize <= 0) {
      throw new Error("Outbox maxBatchSize must be a positive integer.");
    }
  }

  public async dispatchOnce(): Promise<OutboxDispatchResult> {
    const events = await this.store.getPending(this.maxBatchSize);

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

  private async publishAndMark(event: PendingOutboxEvent): Promise<void> {
    await this.publisher.publish(event);
    await this.store.markPublished(event.id);
  }
}
