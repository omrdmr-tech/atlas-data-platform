import assert from "node:assert/strict";
import test from "node:test";

import { ArticleSnapshot } from "../../../domain/entities/article-snapshot.js";
import type { Database } from "../../ports/database.js";
import type { Transaction } from "../../ports/transaction.js";
import { PostgreSQLArticleSnapshotRepository } from "./postgresql-article-snapshot-repository.js";

function harness(rows: Record<string, unknown>[] = []) {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const transaction = {
    async begin() {},
    async commit() {},
    async rollback() {},
    async query(sql: string, values?: unknown[]) {
      queries.push({ sql, values });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Transaction;
  const database = {
    async createTransaction() { return transaction; },
  } as unknown as Database;

  return {
    repository: new PostgreSQLArticleSnapshotRepository(database),
    queries,
  };
}

function article() {
  return new ArticleSnapshot({
    sourceUrl: "https://example.com/story",
    finalUrl: "https://example.com/story",
    html: "<article>News</article>",
    contentType: "text/html",
    fetchedAt: "2026-10-02T12:00:00.000Z",
    scraperId: "http-scraper",
  });
}

test("PostgreSQL article repository lazily initializes and upserts snapshots", async () => {
  const { repository, queries } = harness();

  await repository.save(article());
  await repository.save(article());

  assert.equal(
    queries.filter(({ sql }) => sql.includes("CREATE TABLE IF NOT EXISTS")).length,
    1
  );
  const upsert = queries.find(({ sql }) => sql.includes("INSERT INTO article_snapshots"));
  assert.match(upsert?.sql ?? "", /ON CONFLICT \(source_url\) DO UPDATE/);
  assert.deepEqual(upsert?.values, [
    "https://example.com/story",
    "https://example.com/story",
    "<article>News</article>",
    "text/html",
    "2026-10-02T12:00:00.000Z",
    "http-scraper",
  ]);
});

test("PostgreSQL article repository maps recent snapshots", async () => {
  const { repository, queries } = harness([{
    source_url: "https://example.com/story",
    final_url: "https://example.com/story",
    html: "<article>News</article>",
    content_type: "text/html",
    fetched_at: new Date("2026-10-02T12:00:00.000Z"),
    scraper_id: "http-scraper",
  }]);

  const results = await repository.findRecent(10);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.html, "<article>News</article>");
  assert.equal(results[0]?.fetchedAt, "2026-10-02T12:00:00.000Z");
  assert.deepEqual(queries.at(-1)?.values, [10]);
});

test("PostgreSQL article repository validates recent result limit", async () => {
  const { repository, queries } = harness();

  await assert.rejects(repository.findRecent(0), /between 1 and 500/);
  assert.equal(queries.length, 0);
});
