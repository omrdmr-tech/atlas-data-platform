import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "./scraper.js";
import type { ScraperCapability } from "./scraper-capabilities.js";
import type {
  ScraperOrchestrationResult,
  ScraperOrchestrator,
} from "./scraper-orchestrator.js";

class FakeScraper implements Scraper {
  public readonly descriptor: {
    readonly scraperId: string;
    readonly capabilities: readonly ScraperCapability[];
  };

  public constructor(
    public readonly id: string,
    private readonly handler: (
      request: ScrapeRequest
    ) => Promise<ScrapeResult>,
    capabilities: readonly ScraperCapability[] = ["http"]
  ) {
    this.descriptor = {
      scraperId: id,
      capabilities,
    };
  }

  public async execute(
    request: ScrapeRequest
  ): Promise<ScrapeResult> {
    return this.handler(request);
  }
}

function successResult(
  url: string,
  content: string
): ScrapeResult {
  return {
    url,
    statusCode: 200,
    content,
    contentType: "text/html",
  };
}

test("ScraperOrchestrationResult includes attempt history", async () => {
  const result: ScraperOrchestrationResult = {
    result: successResult(
      "https://example.com",
      "content"
    ),
    scraperId: "scraper",
    failures: [],
    attemptHistory: [
      {
        attempt: 1,
        scraperId: "scraper",
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
        status: "success",
        statusCode: 200,
      },
    ],
  };

  assert.equal(result.attemptHistory.length, 1);
  assert.equal(
    result.attemptHistory[0]?.scraperId,
    "scraper"
  );
  assert.equal(
    result.attemptHistory[0]?.status,
    "success"
  );
});

test("ScraperOrchestrator port remains implementable", async () => {
  const orchestrator: ScraperOrchestrator = {
    execute: async (
      request: ScrapeRequest
    ): Promise<ScraperOrchestrationResult> => ({
      result: successResult(request.url, "content"),
      scraperId: "scraper",
      failures: [],
      attemptHistory: [],
    }),
  };

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "scraper");
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.attemptHistory, []);
});