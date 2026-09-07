import assert from "node:assert/strict";
import test from "node:test";

import type { Scraper } from "../../../application/ports/scraper.js";

import { ScraperOrchestrator } from "./scraper-orchestrator.js";
import {
  AdaptiveScraperSelectionPolicy,
} from "./adaptive-scraper-selection-policy.js";
import {
  DefaultScraperSelectionPolicy,
} from "./default-scraper-selection-policy.js";
import {
  InMemorySourceHealthStore,
} from "./in-memory-source-health-store.js";

import {
  HealthAwareSourceAccessLog,
} from "../logging/health-aware-source-access-log.js";
import {
  InMemorySourceAccessLog,
} from "../logging/in-memory-source-access-log.js";

function createScraper(
  id: string,
  capabilities: readonly ("http" | "browser" | "javascript" | "proxy" | "anti-bot")[],
  execute: Scraper["execute"],
): Scraper {
  return {
    id,
    descriptor: {
      scraperId: id,
      capabilities,
    },
    execute,
  };
}

function successfulResult(url: string, content: string) {
  return {
    url,
    statusCode: 200,
    content,
    contentType: "text/html",
  };
}

function failedResult(url: string, statusCode: number) {
  return {
    url,
    statusCode,
    content: "",
    contentType: "text/html",
  };
}

test("orchestrator learns successful scraper preference across requests", async () => {
  const accessLog = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const healthAwareLog = new HealthAwareSourceAccessLog(
    accessLog,
    healthStore,
  );

  let httpCalls = 0;
  let browserCalls = 0;

  const httpScraper = createScraper(
    "http",
    ["http"],
    async (request) => {
      httpCalls += 1;

      return failedResult(request.url, 403);
    },
  );

  const browserScraper = createScraper(
    "browser",
    ["browser", "javascript"],
    async (request) => {
      browserCalls += 1;

      return successfulResult(request.url, "browser content");
    },
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore,
    new DefaultScraperSelectionPolicy(),
    {
      minimumAttempts: 1,
    },
  );

  const orchestrator = new ScraperOrchestrator(
    [httpScraper, browserScraper],
    policy,
    {
      sourceAccessLog: healthAwareLog,
    },
  );

  const first = await orchestrator.execute({
    url: "https://example.com/article",
  });

  assert.equal(first.scraperId, "browser");
  assert.equal(first.result.statusCode, 200);
  assert.equal(first.result.content, "browser content");

  assert.equal(httpCalls, 1);
  assert.equal(browserCalls, 1);

  const firstHealth = healthStore.get("example.com");

  assert.ok(firstHealth);
  assert.equal(firstHealth.totalAttempts, 2);
  assert.equal(firstHealth.successfulAttempts, 1);
  assert.equal(firstHealth.failedAttempts, 1);

  const second = await orchestrator.execute({
    url: "https://example.com/article-2",
  });

  assert.equal(second.scraperId, "browser");
  assert.equal(second.result.statusCode, 200);

  // Historical health should make browser preferred.
  assert.equal(httpCalls, 1);
  assert.equal(browserCalls, 2);

  const secondHealth = healthStore.get("example.com");

  assert.ok(secondHealth);
  assert.equal(secondHealth.totalAttempts, 3);
  assert.equal(secondHealth.successfulAttempts, 2);
  assert.equal(secondHealth.failedAttempts, 1);

  const browserStats = secondHealth.scraperStats.find(
    (item) => item.scraperId === "browser",
  );

  assert.ok(browserStats);
  assert.equal(browserStats.totalAttempts, 2);
  assert.equal(browserStats.successfulAttempts, 2);
  assert.equal(browserStats.successRate, 1);
});

test("adaptive preference remains source-specific", async () => {
  const accessLog = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const healthAwareLog = new HealthAwareSourceAccessLog(
    accessLog,
    healthStore,
  );

  for (let i = 0; i < 2; i += 1) {
    healthStore.recordAccess({
      sourceId: "example.com",
      domain: "example.com",
      scraperId: "browser",
      accessType: "browser",
      status: "accessible",
      success: true,
      occurredAt: new Date(1000 + i).toISOString(),
    });

    healthStore.recordAccess({
      sourceId: "example.com",
      domain: "example.com",
      scraperId: "http",
      accessType: "http",
      status: "server-error",
      success: false,
      occurredAt: new Date(2000 + i).toISOString(),
    });
  }

  let httpCalls = 0;
  let browserCalls = 0;

  const httpScraper = createScraper(
    "http",
    ["http"],
    async (request) => {
      httpCalls += 1;
      return successfulResult(request.url, "other source content");
    },
  );

  const browserScraper = createScraper(
    "browser",
    ["browser", "javascript"],
    async (request) => {
      browserCalls += 1;
      return successfulResult(request.url, "browser content");
    },
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore,
    new DefaultScraperSelectionPolicy(),
    {
      minimumAttempts: 2,
    },
  );

  const orchestrator = new ScraperOrchestrator(
    [httpScraper, browserScraper],
    policy,
    {
      sourceAccessLog: healthAwareLog,
    },
  );

  const result = await orchestrator.execute({
    url: "https://other-example.com/article",
  });

  assert.equal(result.scraperId, "http");
  assert.equal(result.result.statusCode, 200);

  // Health from example.com must not affect another source.
  assert.equal(httpCalls, 1);
  assert.equal(browserCalls, 0);
});

test("adaptive policy still respects current-request failures", async () => {
  const accessLog = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const healthAwareLog = new HealthAwareSourceAccessLog(
    accessLog,
    healthStore,
  );

  for (let i = 0; i < 2; i += 1) {
    healthStore.recordAccess({
      sourceId: "example.com",
      domain: "example.com",
      scraperId: "http",
      accessType: "http",
      status: "accessible",
      success: true,
      occurredAt: new Date(1000 + i).toISOString(),
    });
  }

  let httpCalls = 0;
  let browserCalls = 0;

  const httpScraper = createScraper(
    "http",
    ["http"],
    async (request) => {
      httpCalls += 1;
      return failedResult(request.url, 403);
    },
  );

  const browserScraper = createScraper(
    "browser",
    ["browser", "javascript"],
    async (request) => {
      browserCalls += 1;
      return successfulResult(request.url, "browser content");
    },
  );

  const policy = new AdaptiveScraperSelectionPolicy(
    healthStore,
    new DefaultScraperSelectionPolicy(),
    {
      minimumAttempts: 2,
    },
  );

  const orchestrator = new ScraperOrchestrator(
    [httpScraper, browserScraper],
    policy,
    {
      sourceAccessLog: healthAwareLog,
    },
  );

  const result = await orchestrator.execute({
    url: "https://example.com/article",
  });

  assert.equal(result.scraperId, "browser");
  assert.equal(result.result.statusCode, 200);

  // Adaptive policy initially prefers HTTP because of historical success,
  // but the current-request failure must remove HTTP from the remaining
  // candidates and allow browser fallback.
  assert.equal(httpCalls, 1);
  assert.equal(browserCalls, 1);

  const health = healthStore.get("example.com");

  assert.ok(health);

  // 2 historical HTTP successes + 1 current HTTP failure + 1 browser success.
  assert.equal(health.totalAttempts, 4);
  assert.equal(health.successfulAttempts, 3);
  assert.equal(health.failedAttempts, 1);

  const httpStats = health.scraperStats.find(
    (item) => item.scraperId === "http",
  );

  assert.ok(httpStats);
  assert.equal(httpStats.totalAttempts, 3);
  assert.equal(httpStats.successfulAttempts, 2);
  assert.equal(httpStats.failedAttempts, 1);
});
