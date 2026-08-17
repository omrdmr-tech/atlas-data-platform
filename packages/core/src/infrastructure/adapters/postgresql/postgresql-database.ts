import { Pool } from "pg";
import type { Database } from "../../ports/database.js";
import type { Transaction } from "../../ports/transaction.js";
import { PostgreSQLTransaction } from "./postgresql-transaction.js";

export interface PostgreSQLDatabaseOptions {
  readonly connectionString: string;
  readonly maxConnections?: number;
}

export class PostgreSQLDatabase implements Database {
  private pool?: Pool;
  private connected = false;

  public constructor(public readonly options: PostgreSQLDatabaseOptions) {}

  public async connect(): Promise<void> {
    if (!this.options.connectionString) {
      throw new Error("PostgreSQL connection string is required.");
    }

    if (this.connected) {
      return;
    }

    this.pool = new Pool({
      connectionString: this.options.connectionString,
      max: this.options.maxConnections
    });

    try {
      await this.pool.query("SELECT 1");
      this.connected = true;
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.pool) {
      this.connected = false;
      return;
    }

    await this.pool.end();

    this.pool = undefined;
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getPool(): Pool {
    if (!this.pool || !this.connected) {
      throw new Error("PostgreSQL database is not connected.");
    }

    return this.pool;
  }

  public async createTransaction(): Promise<Transaction> {
    const client = await this.getPool().connect();
    return new PostgreSQLTransaction(client);
  }
}
