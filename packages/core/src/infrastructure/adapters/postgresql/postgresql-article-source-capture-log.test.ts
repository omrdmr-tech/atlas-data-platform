import assert from "node:assert/strict";
import test from "node:test";

import type { Database } from "../../ports/database.js";
import type { Transaction } from "../../ports/transaction.js";
import { PostgreSQLArticleSourceCaptureLog } from "./postgresql-article-source-capture-log.js";

function harness(rows: Record<string, unknown>[] = []) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const transaction = {
    async begin() {}, async commit() {}, async rollback() {},
    async query(sql: string, values?: unknown[]) {
      queries.push({ sql, values });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Transaction;
  const database = { async createTransaction() { return transaction; } } as unknown as Database;
  return { repository: new PostgreSQLArticleSourceCaptureLog(database), queries };
}

test("PostgreSQL source capture log stores every batch URL and outcome metadata", async () => {
  const { repository, queries } = harness();
  const batchId = await repository.beginBatch(["https://example.com/a", "https://example.com/b"]);
  await repository.complete(batchId, "https://example.com/a", {
    status: "success", details: null, language: "en", region: "US",
  });

  const inserts = queries.filter(({ sql }) => sql.includes("INSERT INTO article_capture_logs"));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0]?.values?.[0], batchId);
  assert.match(queries.find(({ sql }) => sql.includes("UPDATE article_capture_logs"))?.sql ?? "", /language = \$5, region = \$6/);
  assert.deepEqual(queries.at(-1)?.values, ["https://example.com/a", "success", null, "en", "US"]);
});

test("PostgreSQL source capture log maps saved source rows", async () => {
  const { repository } = harness([{
    source_url: "https://example.com/story", language: "tr", region: "TR",
    last_status: "success", last_error: null,
    updated_at: new Date("2026-10-02T12:00:00.000Z"),
  }]);
  const sources = await repository.listSources();
  assert.deepEqual(sources[0], {
    sourceUrl: "https://example.com/story", language: "tr", region: "TR",
    lastStatus: "success", lastError: null, updatedAt: "2026-10-02T12:00:00.000Z",
  });
});
