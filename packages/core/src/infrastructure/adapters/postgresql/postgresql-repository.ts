import type { Pool } from "pg";
import type { Entity } from "../../../domain/entities/entity.js";
import type { Repository } from "../../../domain/repositories/repository.js";

export interface PostgreSQLRepositoryOptions {
  readonly tableName: string;
  readonly idColumn?: string;
}

export abstract class PostgreSQLRepository<TEntity extends Entity<TId>, TId>
  implements Repository<TEntity, TId>
{
  protected constructor(
    protected readonly pool: Pool,
    protected readonly options: PostgreSQLRepositoryOptions
  ) {}

  public async findById(id: TId): Promise<TEntity | null> {
    const idColumn = this.options.idColumn ?? "id";
    const result = await this.pool.query(
      `SELECT * FROM ${this.quoteIdentifier(this.options.tableName)} WHERE ${this.quoteIdentifier(idColumn)} = $1 LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  protected quoteIdentifier(identifier: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
      throw new Error("Invalid SQL identifier.");
    }

    return `"${identifier}"`;
  }

  protected abstract mapRow(row: Record<string, unknown>): TEntity;

  public abstract save(entity: TEntity): Promise<void>;
}
