import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgreSQLDatabase } from "./postgresql-database.js";

test("PostgreSQL adapter rejects an empty connection string", async () => {
  const database = new PostgreSQLDatabase({ connectionString: "" });

  await assert.rejects(
    database.connect(),
    /connection string is required/
  );
});

test("PostgreSQL adapter requires a connection before exposing its pool", () => {
  const database = new PostgreSQLDatabase({
    connectionString: "postgresql://localhost/atlas"
  });

  assert.throws(
    () => database.getPool(),
    /not connected/
  );
});
