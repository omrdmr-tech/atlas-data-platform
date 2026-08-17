import { test } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { PostgreSQLTransaction } from "./postgresql-transaction.js";

function createClient() {
  const queries: string[] = [];

  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    },

    release: () => {
      // Testte PostgreSQL bağlantısının pool'a geri bırakılmasını simüle eder.
    },
  } as unknown as PoolClient;

  return { client, queries };
}

test("PostgreSQL transaction begins and commits", async () => {
  const { client, queries } = createClient();
  const transaction = new PostgreSQLTransaction(client);

  assert.equal(transaction.isActive(), false);

  await transaction.begin();
  assert.equal(transaction.isActive(), true);

  await transaction.commit();
  assert.equal(transaction.isActive(), false);
  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
});

test("PostgreSQL transaction rolls back", async () => {
  const { client, queries } = createClient();
  const transaction = new PostgreSQLTransaction(client);

  await transaction.begin();
  await transaction.rollback();

  assert.equal(transaction.isActive(), false);
  assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
});

test("Repeated commit or rollback does not issue extra SQL", async () => {
  const { client, queries } = createClient();
  const transaction = new PostgreSQLTransaction(client);

  await transaction.commit();
  await transaction.rollback();

  assert.deepEqual(queries, []);
});
