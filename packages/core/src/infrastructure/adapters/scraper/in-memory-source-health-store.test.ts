import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemorySourceHealthStore,
} from "./in-memory-source-health-store.js";

test("source health aggregates successful and failed attempts", () => {
  const store = new InMemorySourceHealthStore();

  store.recordAccess({
    sourceId: "source-1",
    domain: "www.example.com",
    scraperId: "http",
    accessType: "http",
    status: "accessible",
    success: true,
    occurredAt: "2026-09-07T10:00:00.000Z",
  });

  store.recordAccess({
    sourceId: "source-1",
    domain: "example.com",
    scraperId: "http",
    accessType: "http",
    status: "bot-blocked",
    success: false,
    occurredAt: "2026-09-07T10:01:00.000Z",
  });

  const snapshot = store.get("source-1");

  assert.ok(snapshot);
  assert.equal(snapshot.domain, "example.com");
  assert.equal(snapshot.totalAttempts, 2);
  assert.equal(snapshot.successfulAttempts, 1);
  assert.equal(snapshot.failedAttempts, 1);
  assert.equal(snapshot.botBlockedCount, 1);
  assert.equal(snapshot.lastAccessStatus, "bot-blocked");
  assert.equal(snapshot.lastScraperId, "http");
});

test("source health tracks scraper-specific success rates", () => {
  const store = new InMemorySourceHealthStore();

  store.recordAccess({
    sourceId: "source-1",
    domain: "example.com",
    scraperId: "http",
    accessType: "http",
    status: "accessible",
    success: true,
    occurredAt: "2026-09-07T10:00:00.000Z",
  });

  store.recordAccess({
    sourceId: "source-1",
    domain: "example.com",
    scraperId: "http",
    accessType: "http",
    status: "bot-blocked",
    success: false,
    occurredAt: "2026-09-07T10:01:00.000Z",
  });

  store.recordAccess({
    sourceId: "source-1",
    domain: "example.com",
    scraperId: "browser",
    accessType: "browser",
    status: "accessible",
    success: true,
    occurredAt: "2026-09-07T10:02:00.000Z",
  });

  const snapshot = store.getByDomain("WWW.EXAMPLE.COM");

  assert.ok(snapshot);
  assert.equal(snapshot.scraperStats.length, 2);

  const http = snapshot.scraperStats.find(
    (item) => item.scraperId === "http"
  );

  const browser = snapshot.scraperStats.find(
    (item) => item.scraperId === "browser"
  );

  assert.ok(http);
  assert.ok(browser);

  assert.equal(http.totalAttempts, 2);
  assert.equal(http.successfulAttempts, 1);
  assert.equal(http.failedAttempts, 1);
  assert.equal(http.successRate, 0.5);

  assert.equal(browser.totalAttempts, 1);
  assert.equal(browser.successfulAttempts, 1);
  assert.equal(browser.successRate, 1);
});

test("source health counts access failure categories", () => {
  const store = new InMemorySourceHealthStore();

  const statuses = [
    "login-required",
    "subscription-required",
    "paywall",
    "captcha",
    "bot-blocked",
    "rate-limited",
    "network-unavailable",
    "server-error",
    "partial-content",
  ] as const;

  statuses.forEach((status, index) => {
    store.recordAccess({
      sourceId: "source-1",
      domain: "example.com",
      scraperId: "scraper",
      accessType: "http",
      status,
      success: false,
      occurredAt: `2026-09-07T10:${String(index).padStart(2, "0")}:00.000Z`,
    });
  });

  const snapshot = store.get("source-1");

  assert.ok(snapshot);
  assert.equal(snapshot.loginRequiredCount, 1);
  assert.equal(snapshot.subscriptionRequiredCount, 1);
  assert.equal(snapshot.paywallCount, 1);
  assert.equal(snapshot.captchaCount, 1);
  assert.equal(snapshot.botBlockedCount, 1);
  assert.equal(snapshot.rateLimitedCount, 1);
  assert.equal(snapshot.networkUnavailableCount, 1);
  assert.equal(snapshot.serverErrorCount, 1);
  assert.equal(snapshot.partialContentCount, 1);
});

test("unknown source returns null", () => {
  const store = new InMemorySourceHealthStore();

  assert.equal(
    store.get("missing-source"),
    null
  );

  assert.equal(
    store.getByDomain("missing.example.com"),
    null
  );
});

test("source health snapshots do not expose mutable internal state", () => {
  const store = new InMemorySourceHealthStore();

  store.recordAccess({
    sourceId: "source-1",
    domain: "example.com",
    scraperId: "http",
    accessType: "http",
    status: "accessible",
    success: true,
    occurredAt: "2026-09-07T10:00:00.000Z",
  });

  const first = store.get("source-1");

  assert.ok(first);

  const second = store.get("source-1");

  assert.ok(second);
  assert.notEqual(
    first.scraperStats,
    second.scraperStats
  );
  assert.equal(second.scraperStats.length, 1);
  assert.equal(
    second.scraperStats[0]?.scraperId,
    "http"
  );
});
