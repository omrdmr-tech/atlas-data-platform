import type { Pool } from "pg";
import type { IdempotencyStore } from "../../ports/idempotency-store.js";
import type { PostgreSQLDatabase } from "./postgresql-database.js";

export class PostgreSQLIdempotencyStore implements IdempotencyStore {
  private readonly pool: Pool;
  private initialized = false;

  public constructor(database: PostgreSQLDatabase) {
    this.pool = database.getPool();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS event_bus_idempotency (
        event_key TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    this.initialized = true;
  }

  public async has(key: string): Promise<boolean> {
    await this.initialize();

    const result = await this.pool.query(
      "SELECT 1 FROM event_bus_idempotency WHERE event_key = $1 LIMIT 1",
      [key]
    );

    return (result.rowCount ?? 0) > 0;
  }

  public async mark(key: string): Promise<void> {
    await this.initialize();

    await this.pool.query(
      `INSERT INTO event_bus_idempotency (event_key)
       VALUES ($1)
       ON CONFLICT (event_key) DO NOTHING`,
      [key]
    );
  }
}
