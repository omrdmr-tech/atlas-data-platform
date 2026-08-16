import type { Database } from "../../ports/database.js";

export interface PostgreSQLDatabaseOptions {
  readonly connectionString: string;
}

export class PostgreSQLDatabase implements Database {
  private connected = false;

  public constructor(public readonly options: PostgreSQLDatabaseOptions) {}

  public async connect(): Promise<void> {
    if (!this.options.connectionString) {
      throw new Error("PostgreSQL connection string is required.");
    }

    // Actual pg client integration is intentionally deferred.
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}
