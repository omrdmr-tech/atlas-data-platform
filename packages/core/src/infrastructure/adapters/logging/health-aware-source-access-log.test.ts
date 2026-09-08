import assert from "node:assert/strict";
import test from "node:test";

import type {
  SourceAccessLogEntry,
} from "../../../application/ports/source-access-log.js";

import {
  InMemorySourceAccessLog,
} from "./in-memory-source-access-log.js";

import {
  InMemorySourceHealthStore,
} from "../scraper/in-memory-source-health-store.js";

import {
  HealthAwareSourceAccessLog,
} from "./health-aware-source-access-log.js";

function createEntry(
  overrides: Partial<SourceAccessLogEntry> = {}
): SourceAccessLogEntry {
  return {
    requestId: "request-1",
    sourceId: "source-1",
    url: "https://example.com/article",
    domain: "example.com",
    accessStatus: "accessible",
    accessType: "http",
    detectedAt: "2026-09-07T10:00:00.000Z",
    scraperId: "http",
    httpStatus: 200,
    requiresLogin: false,
    requiresSubscription: false,
    paywallDetected: false,
    captchaDetected: false,
    contentAvailable: true,
    ...overrides,
  };
}

test("health-aware source access log preserves access log behavior", async () => {
  const delegate = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const log = new HealthAwareSourceAccessLog(
    delegate,
    healthStore
  );

  await log.append(createEntry());

  assert.equal(log.getAll().length, 1);
  assert.equal(
    log.findByRequestId("request-1").length,
    1
  );
  assert.equal(
    log.findBySourceId("source-1").length,
    1
  );
});

test("health-aware source access log records successful access", async () => {
  const delegate = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const log = new HealthAwareSourceAccessLog(
    delegate,
    healthStore
  );

  await log.append(
    createEntry({
      accessStatus: "accessible",
      contentAvailable: true,
    })
  );

  const health = await healthStore.get("source-1");

  assert.ok(health);
  assert.equal(health.totalAttempts, 1);
  assert.equal(health.successfulAttempts, 1);
  assert.equal(health.failedAttempts, 0);
  assert.equal(health.lastAccessStatus, "accessible");
  assert.equal(health.lastScraperId, "http");
});

test("health-aware source access log records inaccessible HTTP 200 content as failure", async () => {
  const delegate = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const log = new HealthAwareSourceAccessLog(
    delegate,
    healthStore
  );

  await log.append(
    createEntry({
      accessStatus: "login-required",
      contentAvailable: false,
      httpStatus: 200,
      requiresLogin: true,
    })
  );

  const health = await healthStore.get("source-1");

  assert.ok(health);
  assert.equal(health.totalAttempts, 1);
  assert.equal(health.successfulAttempts, 0);
  assert.equal(health.failedAttempts, 1);
  assert.equal(health.loginRequiredCount, 1);
  assert.equal(health.lastAccessStatus, "login-required");
});

test("health-aware source access log records bot blocking and scraper-specific failure", async () => {
  const delegate = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const log = new HealthAwareSourceAccessLog(
    delegate,
    healthStore
  );

  await log.append(
    createEntry({
      scraperId: "browser",
      accessType: "browser",
      accessStatus: "bot-blocked",
      contentAvailable: false,
      httpStatus: 403,
    })
  );

  const health = await healthStore.get("source-1");

  assert.ok(health);
  assert.equal(health.botBlockedCount, 1);
  assert.equal(health.failedAttempts, 1);

  const browser = health.scraperStats.find(
    (item) => item.scraperId === "browser"
  );

  assert.ok(browser);
  assert.equal(browser.totalAttempts, 1);
  assert.equal(browser.failedAttempts, 1);
  assert.equal(browser.successRate, 0);
  assert.equal(browser.lastAccessStatus, "bot-blocked");
});

test("health-aware source access log records network failure without HTTP status", async () => {
  const delegate = new InMemorySourceAccessLog();
  const healthStore = new InMemorySourceHealthStore();

  const log = new HealthAwareSourceAccessLog(
    delegate,
    healthStore
  );

  await log.append(
    createEntry({
      accessStatus: "network-unavailable",
      accessType: "proxy",
      scraperId: "proxy-scraper",
      httpStatus: null,
      contentAvailable: false,
    })
  );

  const health = await healthStore.get("source-1");

  assert.ok(health);
  assert.equal(health.networkUnavailableCount, 1);
  assert.equal(health.failedAttempts, 1);
  assert.equal(health.lastAccessType, "proxy");
});
