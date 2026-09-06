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
      assert.equal(error.failures[0]?.reason, "blocked");
      assert.equal(error.failures[0]?.statusCode, 403);

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
      assert.equal(error.failures[0]?.reason, "rate-limited");
      assert.equal(error.failures[0]?.statusCode, 429);

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
      assert.equal(error.failures[0]?.reason, "server-error");
      assert.equal(error.failures[0]?.statusCode, 500);

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
      assert.equal(error.failures[0]?.reason, "http-error");
      assert.equal(error.failures[0]?.statusCode, 404);

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
      assert.equal(error.failures[0]?.reason, "timeout");
      assert.equal(error.failures[0]?.statusCode, null);

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
      assert.equal(error.failures[0]?.reason, "network-error");
      assert.equal(error.failures[0]?.statusCode, null);

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

    assert.equal(httpScraper.calls.length, 0);
    assert.equal(browserScraper.calls.length, 1);
  }
);
test(
  "ScraperOrchestrator does not record capability-mismatched scrapers as failures",
  async () => {
    const httpScraper = new FakeScraper(
      "http-scraper",
      async () => {
        throw new Error("HTTP scraper should not execute");
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

    assert.equal(result.scraperId, "browser-scraper");
    assert.equal(result.result.content, "browser");
    assert.deepEqual(result.failures, []);

    assert.equal(httpScraper.calls.length, 0);
    assert.equal(browserScraper.calls.length, 1);
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
        assert.deepEqual(error.failures, []);

        return true;
      }
    );

    assert.equal(httpScraper.calls.length, 0);
    assert.equal(browserScraper.calls.length, 0);
  }
);
