import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryProcessLog,
} from "./in-memory-process-log.js";

test("stores process log entries", async () => {
  const log = new InMemoryProcessLog();

  await log.append({
    requestId: "request-1",
    sourceId: "example.com",
    url: "https://example.com",
    startedAt: "2026-09-07T00:00:00.000Z",
    completedAt: "2026-09-07T00:00:01.000Z",
    scraperId: "http-scraper",
    attempt: 1,
    durationMs: 1000,
    status: "failed",
    failureReason: "blocked",
    fallbackUsed: false,
  });

  assert.equal(log.getAll().length, 1);
  assert.equal(
    log.findByRequestId("request-1").length,
    1
  );
});
