import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";
import {
  ScraperOrchestrationError,
  ScraperOrchestrator,
} from "./scraper-orchestrator.js";

class FakeScraper implements Scraper {
  public readonly calls: ScrapeRequest[] = [];

  public constructor(
    public readonly id: string,
    private readonly handler: (
      request: ScrapeRequest
    ) => Promise<ScrapeResult>
  ) {}

  public async execute(
    request: ScrapeRequest
  ): Promise<ScrapeResult> {
    this.calls.push(request);
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

test("ScraperOrchestrator uses the first successful scraper", async () => {
  const first = new FakeScraper(
    "first",
    async (request) =>
      successResult(request.url, "first")
  );

  const second = new FakeScraper(
    "second",
    async (request) =>
      successResult(request.url, "second")
  );

  const orchestrator = new ScraperOrchestrator([
    first,
    second,
  ]);

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "first");
  assert.equal(result.result.content, "first");
  assert.deepEqual(result.failures, []);
  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 0);
});

test("ScraperOrchestrator falls back after a scraper failure", async () => {
  const firstError = new Error("first scraper failed");

  const first = new FakeScraper(
    "first",
    async () => {
      throw firstError;
    }
  );

  const second = new FakeScraper(
    "second",
    async (request) =>
      successResult(request.url, "second")
  );

  const orchestrator = new ScraperOrchestrator([
    first,
    second,
  ]);

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "second");
  assert.equal(result.result.content, "second");

  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.scraperId, "first");
  assert.equal(result.failures[0]?.error, firstError);

  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 1);
});

test("ScraperOrchestrator records all failures", async () => {
  const firstError = new Error("first failed");
  const secondError = new Error("second failed");

  const first = new FakeScraper(
    "first",
    async () => {
      throw firstError;
    }
  );

  const second = new FakeScraper(
    "second",
    async () => {
      throw secondError;
    }
  );

  const orchestrator = new ScraperOrchestrator([
    first,
    second,
  ]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.url,
        "https://example.com"
      );
      assert.equal(error.failures.length, 2);
      assert.equal(
        error.failures[0]?.scraperId,
        "first"
      );
      assert.equal(
        error.failures[0]?.error,
        firstError
      );
      assert.equal(
        error.failures[1]?.scraperId,
        "second"
      );
      assert.equal(
        error.failures[1]?.error,
        secondError
      );

      return true;
    }
  );
});

test("ScraperOrchestrator rejects an empty scraper list", () => {
  assert.throws(
    () => new ScraperOrchestrator([]),
    {
      message: "At least one scraper is required.",
    }
  );
});

test("ScraperOrchestrator preserves scraper order", async () => {
  const calls: string[] = [];

  const first = new FakeScraper(
    "first",
    async () => {
      calls.push("first");
      throw new Error("failed");
    }
  );

  const second = new FakeScraper(
    "second",
    async () => {
      calls.push("second");
      throw new Error("failed");
    }
  );

  const third = new FakeScraper(
    "third",
    async (request) => {
      calls.push("third");
      return successResult(request.url, "third");
    }
  );

  const orchestrator = new ScraperOrchestrator([
    first,
    second,
    third,
  ]);

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "third");
  assert.deepEqual(calls, [
    "first",
    "second",
    "third",
  ]);
});
