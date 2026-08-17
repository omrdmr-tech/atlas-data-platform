import type { PoolClient } from "pg";
import type { Transaction } from "../../ports/transaction.js";

export class PostgreSQLTransaction implements Transaction {
  private active = false;

  public constructor(private readonly client: PoolClient) {}

  public async begin(): Promise<void> {
    if (this.active) {
      return;
    }

    await this.client.query("BEGIN");
    this.active = true;
  }

  public async commit(): Promise<void> {
    if (!this.active) {
      return;
    }

    await this.client.query("COMMIT");
    this.active = false;
  }

  public async rollback(): Promise<void> {
    if (!this.active) {
      return;
    }

    await this.client.query("ROLLBACK");
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }

  public async query<T = Record<string, unknown>>(
    text: string,
    parameters?: readonly unknown[],
  ): Promise<{
    rows: T[];
    rowCount: number | null;
  }> {
    if (!this.active) {
      throw new Error("An active transaction is required to execute a query.");
    }

    const result = await this.client.query(text, parameters as unknown[]);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount,
    };
  }
}
