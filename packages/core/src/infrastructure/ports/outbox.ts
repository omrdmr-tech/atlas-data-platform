import type { Transaction } from "./transaction.js";
export interface OutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly occurredAt: Date;
}

export interface PendingOutboxEvent extends OutboxEvent {
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
  readonly attempts: number;
  readonly leaseOwner: string | null;
  readonly leaseUntil: Date | null;
}

export interface OutboxStore {
  append(event: OutboxEvent, transaction: Transaction): Promise<void>;

  getPending(limit?: number): Promise<PendingOutboxEvent[]>;

  claimPending(
    owner: string,
    limit?: number,
    leaseDurationMs?: number
  ): Promise<PendingOutboxEvent[]>;

  markPublished(id: string, owner: string): Promise<void>;
}
