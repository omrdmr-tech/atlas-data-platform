import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "./scraper.js";
import type { ScraperOrchestrator } from "./scraper-orchestrator.js";

class TestScraper implements Scraper {
  public readonly descriptor = {
    scraperId: "test",
    capabilities: ["http"] as const,
  };

  public constructor(
    public readonly id: string,
    private readonly response: ScrapeResult
  ) {}

  public async execute(
    _request: ScrapeRequest
  ): Promise<ScrapeResult> {
    return this.response;
  }
}

test(
  "ScraperOrchestrator contract exposes an execute operation",
  async () => {
    const scraper = new TestScraper("test", {
      url: "https://example.com",
      statusCode: 200,
      content: "<html></html>",
      contentType: "text/html",
    });

    const orchestrator: ScraperOrchestrator = {
      async execute(request) {
        const result = await scraper.execute(request);

        return {
          result,
          scraperId: scraper.id,
          failures: [],
        };
      },
    };

    const response = await orchestrator.execute({
      url: "https://example.com",
    });

    assert.equal(response.scraperId, "test");
    assert.equal(response.result.statusCode, 200);
    assert.equal(response.result.content, "<html></html>");
    assert.deepEqual(response.failures, []);
  }
);
