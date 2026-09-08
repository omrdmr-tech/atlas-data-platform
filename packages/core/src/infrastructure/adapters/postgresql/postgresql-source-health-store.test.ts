import test from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../../ports/database.js";
import type { Transaction } from "../../ports/transaction.js";
import type {
  SourceHealthAccessRecord,
  SourceHealthSnapshot,
} from "../../../application/ports/source-health.js";
import { PostgreSQLSourceHealthStore } from "./postgresql-source-health-store.js";

class FakeTransaction implements Transaction {
  private active = false;

  public readonly queries: Array<{
    text: string;
    parameters?: readonly unknown[];
  }> = [];

  public commitCount = 0;
  public rollbackCount = 0;

  public responses: Array<{
    rows: unknown[];
    rowCount?: number | null;
  }> = [];

  public failOnQuery = false;

  public async begin(): Promise<void> {
    this.active = true;
  }

  public async commit(): Promise<void> {
    this.commitCount += 1;
    this.active = false;
  }

  public async rollback(): Promise<void> {
    this.rollbackCount += 1;
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
      throw new Error("Transaction is not active.");
    }

    this.queries.push({ text, parameters });

    if (this.failOnQuery) {
      throw new Error("Fake database query failure.");
    }

    const response = this.responses.shift() ?? {
      rows: [],
      rowCount: null,
    };

    return {
      rows: response.rows as T[],
      rowCount: response.rowCount ?? null,
    };
  }
}

class FakeDatabase implements Database {
  public readonly transactions: FakeTransaction[] = [];

  public async connect(): Promise<void> {}

  public async disconnect(): Promise<void> {}

  public isConnected(): boolean {
    return true;
  }

  public async createTransaction(): Promise<Transaction> {
    const transaction = new FakeTransaction();
    this.transactions.push(transaction);
    return transaction;
  }
}

function createRecord(
  overrides: Partial<SourceHealthAccessRecord> = {},
): SourceHealthAccessRecord {
  return {
    sourceId: "source-1",
    domain: "WWW.Example.COM",
    scraperId: "http",
    accessType: "http",
    status: "accessible",
    success: true,
    occurredAt: "2026-09-08T08:00:00.000Z",
    ...overrides,
  };
}

function createSourceRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    source_id: "source-1",
    domain: "example.com",
    total_attempts: 3,
    successful_attempts: 2,
    failed_attempts: 1,
    login_required_count: 1,
    subscription_required_count: 0,
    paywall_count: 0,
    captcha_count: 0,
    bot_blocked_count: 0,
    rate_limited_count: 0,
    network_unavailable_count: 0,
    server_error_count: 0,
    partial_content_count: 0,
    last_access_status: "accessible",
    last_access_type: "http",
    last_scraper_id: "http",
    last_attempt_at: "2026-09-08T08:02:00.000Z",
    last_success_at: "2026-09-08T08:02:00.000Z",
    last_failure_at: "2026-09-08T08:01:00.000Z",
    ...overrides,
  };
}

function createScraperRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    scraper_id: "http",
    access_type: "http",
    total_attempts: 2,
    successful_attempts: 1,
    failed_attempts: 1,
    last_access_status: "accessible",
    last_attempt_at: "2026-09-08T08:02:00.000Z",
    last_success_at: "2026-09-08T08:02:00.000Z",
    last_failure_at: "2026-09-08T08:01:00.000Z",
    ...overrides,
  };
}

test("PostgreSQL source health initializes both tables in one transaction", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await store.initialize();

  assert.equal(database.transactions.length, 1);

  const transaction = database.transactions[0];

  assert.equal(transaction.queries.length, 2);
  assert.match(
    transaction.queries[0].text,
    /CREATE TABLE IF NOT EXISTS source_health/,
  );
  assert.match(
    transaction.queries[1].text,
    /CREATE TABLE IF NOT EXISTS source_health_scrapers/,
  );
  assert.equal(transaction.commitCount, 1);
  assert.equal(transaction.rollbackCount, 0);
});

test("PostgreSQL source health initialization rolls back on failure", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();
  transaction.failOnQuery = true;
  database.transactions.push(transaction);

  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  await assert.rejects(
    () => store.initialize(),
    /Fake database query failure/,
  );

  assert.equal(transaction.commitCount, 0);
  assert.equal(transaction.rollbackCount, 1);
});

test("PostgreSQL source health records successful access and normalizes the domain", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await store.recordAccess(createRecord());

  const transaction = database.transactions[0];

  assert.equal(transaction.commitCount, 1);
  assert.equal(transaction.rollbackCount, 0);
  assert.equal(transaction.queries.length, 2);

  assert.equal(
    transaction.queries[0].parameters?.[0],
    "source-1",
  );
  assert.equal(
    transaction.queries[0].parameters?.[1],
    "example.com",
  );
  assert.equal(
    transaction.queries[0].parameters?.[2],
    1,
  );
  assert.equal(
    transaction.queries[0].parameters?.[3],
    0,
  );
});

test("PostgreSQL source health records failure and status category", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await store.recordAccess(
    createRecord({
      status: "bot-blocked",
      success: false,
      scraperId: "browser",
      accessType: "browser",
    }),
  );

  const transaction = database.transactions[0];

  assert.equal(transaction.commitCount, 1);
  assert.match(
    transaction.queries[0].text,
    /bot_blocked_count/,
  );

  assert.equal(
    transaction.queries[0].parameters?.[2],
    0,
  );
  assert.equal(
    transaction.queries[0].parameters?.[3],
    1,
  );
});

test("PostgreSQL source health accepts accessible status without a category counter", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await store.recordAccess(
    createRecord({
      status: "accessible",
      success: true,
    }),
  );

  const transaction = database.transactions[0];

  assert.equal(transaction.commitCount, 1);
  assert.doesNotMatch(
    transaction.queries[0].text,
    /accessible_count/,
  );
});

test("PostgreSQL source health accepts unknown status without throwing", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await store.recordAccess(
    createRecord({
      status: "unknown",
      success: false,
    }),
  );

  const transaction = database.transactions[0];

  assert.equal(transaction.commitCount, 1);
  assert.equal(transaction.rollbackCount, 0);
});

test("PostgreSQL source health rolls back when recording fails", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();
  transaction.failOnQuery = true;
  database.transactions.push(transaction);

  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  await assert.rejects(
    () => store.recordAccess(createRecord()),
    /Fake database query failure/,
  );

  assert.equal(transaction.commitCount, 0);
  assert.equal(transaction.rollbackCount, 1);
});

test("PostgreSQL source health get maps source and scraper statistics", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();

  transaction.responses = [
    {
      rows: [createSourceRow()],
    },
    {
      rows: [createScraperRow()],
    },
  ];

  database.transactions.push(transaction);
  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  const snapshot = await store.get("source-1");

  assert.ok(snapshot);
  assert.equal(snapshot.sourceId, "source-1");
  assert.equal(snapshot.domain, "example.com");
  assert.equal(snapshot.totalAttempts, 3);
  assert.equal(snapshot.successfulAttempts, 2);
  assert.equal(snapshot.failedAttempts, 1);
  assert.equal(snapshot.loginRequiredCount, 1);
  assert.equal(snapshot.scraperStats.length, 1);
  assert.equal(snapshot.scraperStats[0].scraperId, "http");
  assert.equal(snapshot.scraperStats[0].successRate, 0.5);
  assert.equal(transaction.commitCount, 1);
});

test("PostgreSQL source health get returns null for an unknown source", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();

  transaction.responses = [
    {
      rows: [],
    },
  ];

  database.transactions.push(transaction);
  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  const snapshot = await store.get("missing");

  assert.equal(snapshot, null);
  assert.equal(transaction.commitCount, 1);
});

test("PostgreSQL source health getByDomain normalizes the domain", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();

  transaction.responses = [
    {
      rows: [createSourceRow()],
    },
    {
      rows: [createScraperRow()],
    },
  ];

  database.transactions.push(transaction);
  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  const snapshot = await store.getByDomain("WWW.Example.COM");

  assert.ok(snapshot);
  assert.equal(snapshot.domain, "example.com");
  assert.equal(
    transaction.queries[0].parameters?.[0],
    "example.com",
  );
});

test("PostgreSQL source health getAll maps multiple sources and filters scraper rows", async () => {
  const database = new FakeDatabase();
  const transaction = new FakeTransaction();

  transaction.responses = [
    {
      rows: [
        createSourceRow({
          source_id: "source-1",
          domain: "one.example",
        }),
        createSourceRow({
          source_id: "source-2",
          domain: "two.example",
        }),
      ],
    },
    {
      rows: [
        {
          source_id: "source-1",
          ...createScraperRow({
            scraper_id: "browser",
          }),
        },
        {
          source_id: "source-2",
          ...createScraperRow({
            scraper_id: "proxy",
          }),
        },
      ],
    },
  ];

  database.transactions.push(transaction);
  database.createTransaction = async () => transaction;

  const store = new PostgreSQLSourceHealthStore(database);

  const snapshots = await store.getAll();

  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].sourceId, "source-1");
  assert.equal(snapshots[0].scraperStats.length, 1);
  assert.equal(snapshots[0].scraperStats[0].scraperId, "browser");
  assert.equal(snapshots[1].sourceId, "source-2");
  assert.equal(snapshots[1].scraperStats.length, 1);
  assert.equal(snapshots[1].scraperStats[0].scraperId, "proxy");
});

test("PostgreSQL source health rejects an empty source id", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await assert.rejects(
    () =>
      store.recordAccess(
        createRecord({
          sourceId: "   ",
        }),
      ),
    /Source ID is required/,
  );

  assert.equal(database.transactions.length, 0);
});

test("PostgreSQL source health rejects an empty domain", async () => {
  const database = new FakeDatabase();
  const store = new PostgreSQLSourceHealthStore(database);

  await assert.rejects(
    () =>
      store.recordAccess(
        createRecord({
          domain: "   ",
        }),
      ),
    /Source domain is required/,
  );

  assert.equal(database.transactions.length, 0);
});