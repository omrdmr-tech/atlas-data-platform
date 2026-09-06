import test from "node:test";
import assert from "node:assert/strict";

import type {
  ScrapeRequest,
  Scraper,
} from "../../../application/ports/scraper.js";
import type {
  ScraperFailure,
} from "../../../application/ports/scraper-orchestrator.js";

import { DefaultScraperSelectionPolicy } from "./default-scraper-selection-policy.js";

function scraper(
  id: string,
  capabilities: readonly string[]
): Scraper {
  return {
    id,
    descriptor: {
      scraperId: id,
      capabilities: capabilities as never,
    },
    async execute() {
      return {
        url: "https://example.com",
        statusCode: 200,
        content: "ok",
        contentType: "text/html",
      };
    },
  };
}

function request(): ScrapeRequest {
  return {
    url: "https://example.com",
  };
}

function failure(
  scraperId: string,
  reason: ScraperFailure["reason"]
): ScraperFailure {
  return {
    scraperId,
    reason,
    statusCode: null,
    error: new Error(reason),
  };
}

test("selection policy preserves registration order on first attempt", () => {
  const policy = new DefaultScraperSelectionPolicy();

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser", "javascript"]),
    scraper("proxy", ["http", "proxy"]),
  ];

  const selected = policy.select(request(), candidates, []);

  assert.deepEqual(
    selected.map((item) => item.id),
    ["http", "browser", "proxy"]
  );
});

test("blocked failure prioritizes anti-bot and browser scrapers", () => {
  const policy = new DefaultScraperSelectionPolicy();

  const candidates = [
    scraper("plain-http", ["http"]),
    scraper("browser", ["browser", "javascript"]),
    scraper("anti-bot", ["browser", "anti-bot"]),
  ];

  const selected = policy.select(
    request(),
    candidates,
    [failure("plain-http", "blocked")]
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["anti-bot", "browser"]
  );
});

test("rate limiting prioritizes proxy capable scrapers", () => {
  const policy = new DefaultScraperSelectionPolicy();

  const candidates = [
    scraper("browser", ["browser"]),
    scraper("proxy", ["http", "proxy"]),
    scraper("anti-bot", ["browser", "anti-bot"]),
  ];

  const selected = policy.select(
    request(),
    candidates,
    [failure("browser", "rate-limited")]
  );

  assert.equal(selected[0]?.id, "proxy");
});

test("failed scrapers are excluded from future selections", () => {
  const policy = new DefaultScraperSelectionPolicy();

  const candidates = [
    scraper("http", ["http"]),
    scraper("browser", ["browser"]),
    scraper("proxy", ["proxy"]),
  ];

  const selected = policy.select(
    request(),
    candidates,
    [
      failure("http", "blocked"),
      failure("browser", "timeout"),
    ]
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ["proxy"]
  );
});

test("required capabilities contribute to selection score", () => {
  const policy = new DefaultScraperSelectionPolicy();

  const candidates = [
    scraper("browser", ["browser"]),
    scraper("anti-bot", ["browser", "anti-bot"]),
  ];

  const selected = policy.select(
    {
      url: "https://example.com",
      requiredCapabilities: ["anti-bot"],
    },
    candidates,
    [failure("browser", "blocked")]
  );

  assert.equal(selected[0]?.id, "anti-bot");
});
