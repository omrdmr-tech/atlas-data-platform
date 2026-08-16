import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { Entity } from "../../../domain/entities/entity.js";
import { PostgreSQLRepository } from "./postgresql-repository.js";

class TestEntity extends Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}

class TestRepository extends PostgreSQLRepository<TestEntity, string> {
  public constructor(pool: Pool) {
    super(pool, { tableName: "articles" });
  }

  protected mapRow(row: Record<string, unknown>): TestEntity {
    return new TestEntity(String(row.id), String(row.name));
  }

  public async save(entity: TestEntity): Promise<void> {
    await this.pool.query(
      'INSERT INTO "articles" ("id", "name") VALUES ($1, $2)',
      [entity.id, entity.name]
    );
  }
}

test("PostgreSQL repository maps a database row to an entity", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];

  const pool = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ id: "1", name: "Atlas" }] };
    }
  } as unknown as Pool;

  const repository = new TestRepository(pool);
  const entity = await repository.findById("1");

  assert.deepEqual(entity, new TestEntity("1", "Atlas"));
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, ["1"]);
});

test("PostgreSQL repository returns null when no row exists", async () => {
  const pool = {
    query: async () => ({ rows: [] })
  } as unknown as Pool;

  const repository = new TestRepository(pool);

  assert.equal(await repository.findById("missing"), null);
});

test("PostgreSQL repository rejects unsafe table names", async () => {
  const pool = {
    query: async () => ({ rows: [] })
  } as unknown as Pool;

  const repository = new TestRepository(pool);
  (repository as unknown as { options: { tableName: string } }).options.tableName =
    "articles; DROP TABLE users";

  await assert.rejects(
    repository.findById("1"),
    /Invalid SQL identifier/
  );
});
