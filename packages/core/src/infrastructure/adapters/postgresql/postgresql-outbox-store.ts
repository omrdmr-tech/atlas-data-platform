import type {
  OutboxEvent,
  OutboxStore,
  PendingOutboxEvent,
  Transaction
} from "../../ports/outbox.js";

export class PostgreSQLOutboxStore implements OutboxStore {
  public constructor(private readonly pool: {
    query<T = Record<string, unknown>>(
      text: string,
      parameters?: readonly unknown[]
    ): Promise<{ rows: T[]; rowCount: number | null }>;
  }) {}

  public async append(event: OutboxEvent, transaction: Transaction): Promise<void> {
    if (!event.id) throw new Error("Outbox event id is required.");
    if (!event.type) throw new Error("Outbox event type is required.");
    if (!transaction.isActive()) {
      throw new Error("An active transaction is required to append an outbox event.");
    }

    await transaction.query(
      `INSERT INTO atlas_outbox_events
        (id, event_type, payload, occurred_at, published_at, attempts)
       VALUES ($1, $2, $3::jsonb, $4, NULL, 0)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, event.type, JSON.stringify(event.payload), event.occurredAt]
    );
  }

  public async getPending(limit = 100): Promise<PendingOutboxEvent[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("Outbox limit must be a positive integer.");
    }

    const result = await this.pool.query<{
      id: string;
      event_type: string;
      payload: unknown;
      occurred_at: Date;
      created_at: Date;
      published_at: Date | null;
      attempts: number;
    }>(
      `SELECT id, event_type, payload, occurred_at, created_at, published_at, attempts
       FROM atlas_outbox_events
       WHERE published_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.event_type,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at),
      createdAt: new Date(row.created_at),
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      attempts: row.attempts
    }));
  }

  public async markPublished(id: string): Promise<void> {
    if (!id) throw new Error("Outbox event id is required.");

    await this.pool.query(
      `UPDATE atlas_outbox_events
       SET published_at = CURRENT_TIMESTAMP,
           attempts = attempts + 1
       WHERE id = $1
         AND published_at IS NULL`,
      [id]
    );
  }
}
