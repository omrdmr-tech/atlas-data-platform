import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScraperCapability,
} from "../../../application/ports/scraper-capabilities.js";
import type {
  ScrapeRequest,
  ScrapeResult,
  Scraper,
} from "../../../application/ports/scraper.js";
import { ScraperRegistry } from "./scraper-registry.js";

class FakeScraper implements Scraper {
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

function scraper(
  id: string,
  capabilities: readonly ScraperCapability[]
): FakeScraper {
  return new FakeScraper(id, {
    scraperId: id,
    capabilities,
  });
}

test("ScraperRegistry registers and returns scrapers", () => {
  const registry = new ScraperRegistry();

  const http = scraper("http-scraper", ["http"]);
  const browser = scraper("browser-scraper", [
    "browser",
    "javascript",
  ]);

  registry.register(http);
  registry.register(browser);

  assert.deepEqual(registry.getAll(), [
    http,
    browser,
  ]);
});

test("ScraperRegistry finds a scraper by id", () => {
  const registry = new ScraperRegistry();

  const http = scraper("http-scraper", ["http"]);

  registry.register(http);

  assert.equal(
    registry.findById("http-scraper"),
    http
  );

  assert.equal(
    registry.findById("missing"),
    null
  );
});

test("ScraperRegistry finds scrapers matching all required capabilities", () => {
  const registry = new ScraperRegistry();

  const http = scraper("http-scraper", ["http"]);

  const browser = scraper("browser-scraper", [
    "browser",
    "javascript",
  ]);

  const browserProxy = scraper(
    "browser-proxy-scraper",
    [
      "browser",
      "javascript",
      "proxy",
    ]
  );

  registry.register(http);
  registry.register(browser);
  registry.register(browserProxy);

  assert.deepEqual(
    registry.findByCapabilities([
      "browser",
      "javascript",
    ]),
    [browser, browserProxy]
  );

  assert.deepEqual(
    registry.findByCapabilities([
      "browser",
      "javascript",
      "proxy",
    ]),
    [browserProxy]
  );
});

test("ScraperRegistry returns all scrapers when no capabilities are required", () => {
  const registry = new ScraperRegistry();

  const http = scraper("http-scraper", ["http"]);
  const browser = scraper("browser-scraper", [
    "browser",
    "javascript",
  ]);

  registry.register(http);
  registry.register(browser);

  assert.deepEqual(
    registry.findByCapabilities([]),
    [http, browser]
  );
});

test("ScraperRegistry rejects duplicate scraper ids", () => {
  const registry = new ScraperRegistry();

  registry.register(
    scraper("http-scraper", ["http"])
  );

  assert.throws(
    () =>
      registry.register(
        scraper("http-scraper", ["browser"])
      ),
    {
      message:
        'Scraper "http-scraper" is already registered.',
    }
  );
});

test("ScraperRegistry preserves registration order", () => {
  const registry = new ScraperRegistry();

  const first = scraper("first", ["browser"]);
  const second = scraper("second", ["browser"]);
  const third = scraper("third", ["browser"]);

  registry.register(first);
  registry.register(second);
  registry.register(third);

  assert.deepEqual(
    registry.findByCapabilities(["browser"]),
    [first, second, third]
  );
});

test("ScraperRegistry does not expose its internal scraper list", () => {
  const registry = new ScraperRegistry();

  const http = scraper("http-scraper", ["http"]);

  registry.register(http);

  const scrapers = registry.getAll() as Scraper[];

  scrapers.pop();

  assert.deepEqual(
    registry.getAll(),
    [http]
  );
});
