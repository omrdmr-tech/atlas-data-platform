import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScraperCapability,
} from "./scraper-capabilities.js";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "./scraper.js";
import type {
  ScraperRegistry,
} from "./scraper-registry.js";

class TestScraper implements Scraper {
  public constructor(
    public readonly id: string,
    public readonly descriptor: {
      readonly scraperId: string;
      readonly capabilities: readonly ScraperCapability[];
    }
  ) {}

  public async execute(
    request: ScrapeRequest
  ): Promise<ScrapeResult> {
    return {
      url: request.url,
      statusCode: 200,
      content: this.id,
      contentType: "text/html",
    };
  }
}

test("ScraperRegistry contract exposes registration and lookup operations", () => {
  const scraper = new TestScraper(
    "http-scraper",
    {
      scraperId: "http-scraper",
      capabilities: ["http"],
    }
  );

  const registry: ScraperRegistry = {
    register() {},
    getAll() {
      return [scraper];
    },
    findByCapabilities() {
      return [scraper];
    },
    findById(scraperId) {
      return scraperId === scraper.id
        ? scraper
        : null;
    },
  };

  registry.register(scraper);

  assert.deepEqual(
    registry.getAll(),
    [scraper]
  );

  assert.deepEqual(
    registry.findByCapabilities(["http"]),
    [scraper]
  );

  assert.equal(
    registry.findById("http-scraper"),
    scraper
  );

  assert.equal(
    registry.findById("missing"),
    null
  );
});
