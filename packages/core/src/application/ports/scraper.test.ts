import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "./scraper.js";

class TestScraper implements Scraper {
  public readonly id = "test-scraper";

  public readonly descriptor = {
    scraperId: "test-scraper",
    capabilities: ["http"] as const,
  };

  public async execute(request: ScrapeRequest): Promise<ScrapeResult> {
    return {
      url: request.url,
      statusCode: 200,
      content: "<html></html>",
      contentType: "text/html",
    };
  }
}

test("Scraper executes a scrape request", async () => {
  const scraper = new TestScraper();

  const result = await scraper.execute({
    url: "https://example.com",
  });

  assert.equal(scraper.id, "test-scraper");
  assert.equal(scraper.descriptor.scraperId, "test-scraper");
  assert.deepEqual(scraper.descriptor.capabilities, ["http"]);
  assert.equal(result.url, "https://example.com");
  assert.equal(result.statusCode, 200);
  assert.equal(result.content, "<html></html>");
  assert.equal(result.contentType, "text/html");
});
