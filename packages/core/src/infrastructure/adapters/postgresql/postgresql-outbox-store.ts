import type {
  OutboxStore,
  OutboxEvent,
  PendingOutboxEvent
} from "../../ports/outbox.js";
import type { Transaction } from "../../ports/transaction.js";

interface OutboxRow {
  id: string;
  event_type: string;
  payload: unknown;
  occurred_at: Date;
  created_at: Date;
  published_at: Date | null;
  attempts: number;
  lease_owner: string | null;
  lease_until: Date | null;
}

export class PostgreSQLOutboxStore implements OutboxStore {
  public constructor(
    private readonly pool: {
      query<T = Record<string, unknown>>(
        text: string,
        parameters?: readonly unknown[]
      ): Promise<{
        rows: T[];
        rowCount: number | null;
      }>;
    }
  ) {}

  public async append(
    event: OutboxEvent,
    transaction: Transaction
  ): Promise<void> {
    if (!event.id) {
      throw new Error("Outbox event id is required.");
    }

    if (!event.type) {
      throw new Error("Outbox event type is required.");
    }

    if (!transaction.isActive()) {
      throw new Error(
        "An active transaction is required to append an outbox event."
      );
    }

    await transaction.query(
      `INSERT INTO atlas_outbox_events
        (id, event_type, payload, occurred_at, published_at, attempts)
       VALUES ($1, $2, $3::jsonb, $4, NULL, 0)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.type,
        JSON.stringify(event.payload),
        event.occurredAt
      ]
    );
  }

  public async getPending(
    limit = 100
  ): Promise<PendingOutboxEvent[]> {
    this.validateLimit(limit);

    const result = await this.pool.query<OutboxRow>(
      `SELECT
         id,
         event_type,
         payload,
         occurred_at,
         created_at,
         published_at,
         attempts,
         lease_owner,
         lease_until
       FROM atlas_outbox_events
       WHERE published_at IS NULL
       ORDER BY created_at ASC, id ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  public async claimPending(
    owner: string,
    limit = 100,
    leaseDurationMs = 30_000
  ): Promise<PendingOutboxEvent[]> {
    if (!owner) {
      throw new Error("Outbox lease owner is required.");
    }

    this.validateLimit(limit);

    if (
      !Number.isInteger(leaseDurationMs) ||
      leaseDurationMs <= 0
    ) {
      throw new Error(
        "Outbox leaseDurationMs must be a positive integer."
      );
    }

    const result = await this.pool.query<OutboxRow>(
      `WITH candidates AS (
         SELECT id
         FROM atlas_outbox_events
         WHERE published_at IS NULL
           AND (
             lease_until IS NULL
             OR lease_until <= CURRENT_TIMESTAMP
           )
         ORDER BY created_at ASC, id ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE atlas_outbox_events AS events
       SET lease_owner = $2,
           lease_until =
             CURRENT_TIMESTAMP +
             ($3 * INTERVAL '1 millisecond'),
           attempts = attempts + 1
       FROM candidates
       WHERE events.id = candidates.id
       RETURNING
         events.id,
         events.event_type,
         events.payload,
         events.occurred_at,
         events.created_at,
         events.published_at,
         events.attempts,
         events.lease_owner,
         events.lease_until`,
      [limit, owner, leaseDurationMs]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  public async markPublished(
    id: string,
    owner: string
  ): Promise<void> {
    if (!id) {
      throw new Error("Outbox event id is required.");
    }

    if (!owner) {
      throw new Error("Outbox lease owner is required.");
    }

    await this.pool.query(
      `UPDATE atlas_outbox_events
       SET published_at = CURRENT_TIMESTAMP,
           lease_owner = NULL,
           lease_until = NULL
       WHERE id = $1
         AND published_at IS NULL
         AND lease_owner = $2`,
      [id, owner]
    );
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(
        "Outbox limit must be a positive integer."
      );
    }
  }

  private mapRow(row: OutboxRow): PendingOutboxEvent {
    return {
      id: row.id,
      type: row.event_type,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at),
      createdAt: new Date(row.created_at),
      publishedAt: row.published_at
        ? new Date(row.published_at)
        : null,
      attempts: row.attempts,
      leaseOwner: row.lease_owner,
      leaseUntil: row.lease_until
        ? new Date(row.lease_until)
        : null
    };
  }
}