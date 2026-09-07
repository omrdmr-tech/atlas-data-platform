import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemorySourceAccessLog,
} from "./in-memory-source-access-log.js";

test("stores and filters source access entries", async () => {
  const log = new InMemorySourceAccessLog();

  await log.append({
    requestId: "request-1",
    sourceId: "example.com",
    url: "https://example.com",
    domain: "example.com",
    accessStatus: "subscription-required",
    accessType: "http",
    detectedAt: "2026-09-07T00:00:00.000Z",
    scraperId: "http-scraper",
    httpStatus: 200,
    requiresLogin: false,
    requiresSubscription: true,
    paywallDetected: true,
    captchaDetected: false,
    contentAvailable: false,
  });

  assert.equal(log.getAll().length, 1);
  assert.equal(
    log.findByRequestId("request-1").length,
    1
  );
  assert.equal(
    log.findBySourceId("example.com").length,
    1
  );
});
