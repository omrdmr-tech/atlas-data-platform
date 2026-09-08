import assert from "node:assert/strict";
import test from "node:test";

import type {
  Scraper,
} from "../../../application/ports/scraper.js";

import {
  InMemorySourceHealthStore,
} from "./in-memory-source-health-store.js";

import {
  AdaptiveScraperSelectionPolicy,
} from "./adaptive-scraper-selection-policy.js";

function scraper(
  id: string,
  capabilities: readonly string[]
): Scraper {
  return {
    id,
    descriptor: {
      scraperId: id,
      capabilities: capabilities as never,
    },
    async execute() {
      return {
        url: "https://example.com",
        statusCode: 200,
        content: "ok",
        contentType: "text/html",
      };
    },
  };
}

function record(
  store: InMemorySourceHealthStore,
  scraperId: string,
  accessType: "http" | "browser" | "proxy",
  success: boolean,
  occurredAt: string
): void {
  store.recordAccess({
    sourceId: "example.com",
    domain: "example.com",
    scraperId,
    accessType,
    status: success ? "accessible" : "bot-blocked",
    success,
    occurredAt,
  });
}

test("adaptive policy preserves baseline order without health history", async () => {
  const healthStore = new InMemorySourceHealthStore();

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore
  );

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
    scraper("proxy", ["http", "proxy"]),
  ];

  const selected = await policy.select(
    {
      url: "https://example.com",
    },
    candidates,
    []
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["http", "browser", "proxy"]
  );
});

test("adaptive policy does not trust insufficient health history", async () => {
  const healthStore = new InMemorySourceHealthStore();

  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:00:00.000Z"
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore
  );

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
  ];

  const selected = await policy.select(
    {
      url: "https://example.com",
    },
    candidates,
    []
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["http", "browser"]
  );
});

test("adaptive policy prioritizes scraper with stronger historical success rate", async () => {
  const healthStore = new InMemorySourceHealthStore();

  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:00:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:01:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    true,
    "2026-09-07T10:02:00.000Z"
  );

  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:03:00.000Z"
  );
  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:04:00.000Z"
  );
  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:05:00.000Z"
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore
  );

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
  ];

  const selected = await policy.select(
    {
      url: "https://example.com",
    },
    candidates,
    []
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["browser", "http"]
  );
});

test("adaptive policy keeps failed scrapers excluded by baseline policy", async () => {
  const healthStore = new InMemorySourceHealthStore();

  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:00:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:01:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:02:00.000Z"
  );

  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:03:00.000Z"
  );
  record(
    healthStore,
    "browser",
    "browser",
    true,
    "2026-09-07T10:04:00.000Z"
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore
  );

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
  ];

  const selected = await policy.select(
    {
      url: "https://example.com",
    },
    candidates,
    [
      {
        scraperId: "browser",
        reason: "timeout",
        statusCode: null,
        error: new Error("timeout"),
      },
    ]
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["http"]
  );
});

test("adaptive policy does not permanently blacklist historically weak scrapers", async () => {
  const healthStore = new InMemorySourceHealthStore();

  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:00:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:01:00.000Z"
  );
  record(
    healthStore,
    "http",
    "http",
    false,
    "2026-09-07T10:02:00.000Z"
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore
  );

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
  ];

  const selected = await policy.select(
    {
      url: "https://example.com",
    },
    candidates,
    []
  );

  assert.equal(
    selected.length,
    2
  );

  assert.ok(
    selected.some(
      (item) => item.id === "http"
    )
  );
});
