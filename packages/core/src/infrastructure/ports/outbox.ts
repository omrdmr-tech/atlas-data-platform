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
}

export interface OutboxStore {
  append(event: OutboxEvent, transaction: Transaction): Promise<void>;
  getPending(limit?: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
}

export interface Transaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
  query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
