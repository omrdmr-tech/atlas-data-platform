import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgreSQLDatabase } from "./postgresql-database.js";

test("PostgreSQL adapter connects and disconnects", async () => {
  const database = new PostgreSQLDatabase({
    connectionString: "postgresql://localhost/atlas"
  });

  assert.equal(database.isConnected(), false);

  await database.connect();
  assert.equal(database.isConnected(), true);

  await database.disconnect();
  assert.equal(database.isConnected(), false);
});

test("PostgreSQL adapter requires a connection string", async () => {
  const database = new PostgreSQLDatabase({ connectionString: "" });

  await assert.rejects(
    database.connect(),
    /connection string is required/
  );
});
