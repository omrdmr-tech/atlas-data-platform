import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";
import type { ScraperCapability } from "../../../application/ports/scraper-capabilities.js";
import {
  ScraperOrchestrationError,
  ScraperOrchestrator,
} from "./scraper-orchestrator.js";

class FakeScraper implements Scraper {
  public readonly calls: ScrapeRequest[] = [];

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
  assert.equal(result.attemptHistory.length, 1);
  assert.equal(result.attemptHistory[0]?.attempt, 1);
  assert.equal(result.attemptHistory[0]?.scraperId, "first");
  assert.equal(result.attemptHistory[0]?.status, "success");
  assert.equal(result.attemptHistory[0]?.failureReason, undefined);
  assert.equal(result.attemptHistory[0]?.statusCode, 200);
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

  assert.equal(result.attemptHistory.length, 2);

  assert.equal(
    result.attemptHistory[0]?.attempt,
    1
  );
  assert.equal(
    result.attemptHistory[0]?.scraperId,
    "first"
  );
  assert.equal(
    result.attemptHistory[0]?.status,
    "failed"
  );
  assert.equal(
    result.attemptHistory[0]?.failureReason,
    "unknown"
  );
  assert.equal(
    result.attemptHistory[0]?.statusCode,
    null
  );
  assert.equal(
    result.attemptHistory[0]?.error,
    "first scraper failed"
  );

  assert.equal(
    result.attemptHistory[1]?.attempt,
    2
  );
  assert.equal(
    result.attemptHistory[1]?.scraperId,
    "second"
  );
  assert.equal(
    result.attemptHistory[1]?.status,
    "success"
  );
  assert.equal(
    result.attemptHistory[1]?.failureReason,
    undefined
  );
  assert.equal(
    result.attemptHistory[1]?.statusCode,
    200
  );

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

      assert.equal(
        error.attemptHistory.length,
        2
      );

      assert.equal(
        error.attemptHistory[0]?.attempt,
        1
      );
      assert.equal(
        error.attemptHistory[0]?.scraperId,
        "first"
      );
      assert.equal(
        error.attemptHistory[0]?.status,
        "failed"
      );
      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "unknown"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        null
      );
      assert.equal(
        error.attemptHistory[0]?.error,
        "first failed"
      );

      assert.equal(
        error.attemptHistory[1]?.attempt,
        2
      );
      assert.equal(
        error.attemptHistory[1]?.scraperId,
        "second"
      );
      assert.equal(
        error.attemptHistory[1]?.status,
        "failed"
      );
      assert.equal(
        error.attemptHistory[1]?.failureReason,
        "unknown"
      );
      assert.equal(
        error.attemptHistory[1]?.statusCode,
        null
      );
      assert.equal(
        error.attemptHistory[1]?.error,
        "second failed"
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

  assert.equal(result.attemptHistory.length, 3);
  assert.deepEqual(
    result.attemptHistory.map(
      (entry) => entry.scraperId
    ),
    ["first", "second", "third"]
  );
  assert.deepEqual(
    result.attemptHistory.map(
      (entry) => entry.status
    ),
    ["failed", "failed", "success"]
  );
});

test("ScraperOrchestrator classifies HTTP 403 as blocked", async () => {
  const scraper = new FakeScraper(
    "blocked-scraper",
    async (request) => ({
      url: request.url,
      statusCode: 403,
      content: "Forbidden",
      contentType: "text/html",
    })
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(error.failures.length, 1);
      assert.equal(
        error.failures[0]?.reason,
        "blocked"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        403
      );

      assert.equal(
        error.attemptHistory.length,
        1
      );
      assert.equal(
        error.attemptHistory[0]?.scraperId,
        "blocked-scraper"
      );
      assert.equal(
        error.attemptHistory[0]?.status,
        "failed"
      );
      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "blocked"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        403
      );

      return true;
    }
  );
});

test("ScraperOrchestrator classifies HTTP 429 as rate-limited", async () => {
  const scraper = new FakeScraper(
    "rate-limited-scraper",
    async (request) => ({
      url: request.url,
      statusCode: 429,
      content: "Too Many Requests",
      contentType: "text/html",
    })
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.failures[0]?.reason,
        "rate-limited"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        429
      );

      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "rate-limited"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        429
      );

      return true;
    }
  );
});

test("ScraperOrchestrator classifies HTTP 500 as server-error", async () => {
  const scraper = new FakeScraper(
    "server-error-scraper",
    async (request) => ({
      url: request.url,
      statusCode: 500,
      content: "Internal Server Error",
      contentType: "text/html",
    })
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.failures[0]?.reason,
        "server-error"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        500
      );

      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "server-error"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        500
      );

      return true;
    }
  );
});

test("ScraperOrchestrator classifies HTTP 404 as http-error", async () => {
  const scraper = new FakeScraper(
    "not-found-scraper",
    async (request) => ({
      url: request.url,
      statusCode: 404,
      content: "Not Found",
      contentType: "text/html",
    })
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.failures[0]?.reason,
        "http-error"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        404
      );

      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "http-error"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        404
      );

      return true;
    }
  );
});

test("ScraperOrchestrator classifies AbortError as timeout", async () => {
  const scraper = new FakeScraper(
    "timeout-scraper",
    async () => {
      throw new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
    }
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.failures[0]?.reason,
        "timeout"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        null
      );

      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "timeout"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        null
      );

      return true;
    }
  );
});

test("ScraperOrchestrator classifies TypeError as network-error", async () => {
  const scraper = new FakeScraper(
    "network-scraper",
    async () => {
      throw new TypeError("fetch failed");
    }
  );

  const orchestrator = new ScraperOrchestrator([scraper]);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(
        error.failures[0]?.reason,
        "network-error"
      );
      assert.equal(
        error.failures[0]?.statusCode,
        null
      );

      assert.equal(
        error.attemptHistory[0]?.failureReason,
        "network-error"
      );
      assert.equal(
        error.attemptHistory[0]?.statusCode,
        null
      );

      return true;
    }
  );
});

test(
  "ScraperOrchestrator skips scrapers that do not satisfy required capabilities",
  async () => {
    const httpScraper = new FakeScraper(
      "http-scraper",
      async (request) =>
        successResult(request.url, "http"),
      ["http"]
    );

    const browserScraper = new FakeScraper(
      "browser-scraper",
      async (request) =>
        successResult(request.url, "browser"),
      ["browser", "javascript"]
    );

    const orchestrator = new ScraperOrchestrator([
      httpScraper,
      browserScraper,
    ]);

    const result = await orchestrator.execute({
      url: "https://example.com",
      requiredCapabilities: [
        "browser",
        "javascript",
      ],
    });

    assert.equal(
      result.scraperId,
      "browser-scraper"
    );

    assert.equal(
      result.result.content,
      "browser"
    );

    assert.equal(
      httpScraper.calls.length,
      0
    );
    assert.equal(
      browserScraper.calls.length,
      1
    );

    assert.equal(
      result.attemptHistory.length,
      1
    );
    assert.equal(
      result.attemptHistory[0]?.scraperId,
      "browser-scraper"
    );
    assert.equal(
      result.attemptHistory[0]?.status,
      "success"
    );
  }
);

test(
  "ScraperOrchestrator does not record capability-mismatched scrapers as failures",
  async () => {
    const httpScraper = new FakeScraper(
      "http-scraper",
      async () => {
        throw new Error(
          "HTTP scraper should not execute"
        );
      },
      ["http"]
    );

    const browserScraper = new FakeScraper(
      "browser-scraper",
      async (request) =>
        successResult(request.url, "browser"),
      ["browser", "javascript"]
    );

    const orchestrator = new ScraperOrchestrator([
      httpScraper,
      browserScraper,
    ]);

    const result = await orchestrator.execute({
      url: "https://example.com",
      requiredCapabilities: ["browser"],
    });

    assert.equal(
      result.scraperId,
      "browser-scraper"
    );
    assert.equal(
      result.result.content,
      "browser"
    );
    assert.deepEqual(result.failures, []);

    assert.equal(
      httpScraper.calls.length,
      0
    );
    assert.equal(
      browserScraper.calls.length,
      1
    );

    assert.equal(
      result.attemptHistory.length,
      1
    );
    assert.equal(
      result.attemptHistory[0]?.scraperId,
      "browser-scraper"
    );
    assert.equal(
      result.attemptHistory[0]?.status,
      "success"
    );
  }
);

test(
  "ScraperOrchestrator fails when no scraper satisfies required capabilities",
  async () => {
    const httpScraper = new FakeScraper(
      "http-scraper",
      async () =>
        successResult(
          "https://example.com",
          "http"
        ),
      ["http"]
    );

    const browserScraper = new FakeScraper(
      "browser-scraper",
      async () =>
        successResult(
          "https://example.com",
          "browser"
        ),
      ["browser", "javascript"]
    );

    const orchestrator = new ScraperOrchestrator([
      httpScraper,
      browserScraper,
    ]);

    await assert.rejects(
      orchestrator.execute({
        url: "https://example.com",
        requiredCapabilities: ["proxy"],
      }),
      (error: unknown) => {
        assert.ok(
          error instanceof ScraperOrchestrationError
        );

        assert.equal(
          error.url,
          "https://example.com"
        );

        assert.deepEqual(
          error.failures,
          []
        );

        assert.deepEqual(
          error.attemptHistory,
          []
        );

        return true;
      }
    );

    assert.equal(
      httpScraper.calls.length,
      0
    );
    assert.equal(
      browserScraper.calls.length,
      0
    );
  }
);

test("ScraperOrchestrator stops when maxAttempts is exhausted", async () => {
  const first = new FakeScraper(
    "first",
    async () => {
      throw new Error("first failed");
    }
  );

  const second = new FakeScraper(
    "second",
    async () => {
      throw new Error("second failed");
    }
  );

  const third = new FakeScraper(
    "third",
    async () => {
      throw new Error(
        "third should not execute"
      );
    }
  );

  const orchestrator = new ScraperOrchestrator(
    [first, second, third],
    undefined,
    { maxAttempts: 2 }
  );

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(error.attempts, 2);
      assert.equal(error.maxAttempts, 2);
      assert.equal(error.budgetExhausted, true);
      assert.equal(
        error.failures.length,
        2
      );

      assert.equal(
        error.attemptHistory.length,
        2
      );

      assert.deepEqual(
        error.attemptHistory.map(
          (entry) => entry.attempt
        ),
        [1, 2]
      );

      assert.deepEqual(
        error.attemptHistory.map(
          (entry) => entry.scraperId
        ),
        ["first", "second"]
      );

      assert.deepEqual(
        error.attemptHistory.map(
          (entry) => entry.status
        ),
        ["failed", "failed"]
      );

      return true;
    }
  );

  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 1);
  assert.equal(third.calls.length, 0);
});

test("ScraperOrchestrator uses default maxAttempts of 3", async () => {
  const scrapers = [1, 2, 3, 4].map(
    (number) =>
      new FakeScraper(
        `scraper-${number}`,
        async () => {
          throw new Error(
            `failure-${number}`
          );
        }
      )
  );

  const orchestrator = new ScraperOrchestrator(scrapers);

  await assert.rejects(
    orchestrator.execute({
      url: "https://example.com",
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(error.attempts, 3);
      assert.equal(error.maxAttempts, 3);
      assert.equal(error.budgetExhausted, true);
      assert.equal(
        error.failures.length,
        3
      );

      assert.equal(
        error.attemptHistory.length,
        3
      );

      assert.deepEqual(
        error.attemptHistory.map(
          (entry) => entry.attempt
        ),
        [1, 2, 3]
      );

      assert.deepEqual(
        error.attemptHistory.map(
          (entry) => entry.scraperId
        ),
        [
          "scraper-1",
          "scraper-2",
          "scraper-3",
        ]
      );

      return true;
    }
  );

  assert.equal(
    scrapers[0]?.calls.length,
    1
  );
  assert.equal(
    scrapers[1]?.calls.length,
    1
  );
  assert.equal(
    scrapers[2]?.calls.length,
    1
  );
  assert.equal(
    scrapers[3]?.calls.length,
    0
  );
});

test("ScraperOrchestrator rejects invalid maxAttempts", () => {
  const scraper = new FakeScraper(
    "scraper",
    async (request) =>
      successResult(request.url, "ok")
  );

  assert.throws(
    () =>
      new ScraperOrchestrator(
        [scraper],
        undefined,
        { maxAttempts: 0 }
      ),
    {
      message:
        "maxAttempts must be a positive integer.",
    }
  );

  assert.throws(
    () =>
      new ScraperOrchestrator(
        [scraper],
        undefined,
        { maxAttempts: 1.5 }
      ),
    {
      message:
        "maxAttempts must be a positive integer.",
    }
  );
});