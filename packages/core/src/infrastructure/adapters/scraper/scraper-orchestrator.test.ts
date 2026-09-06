import test from "node:test";
import assert from "node:assert/strict";

import type { Scraper } from "../../../application/ports/scraper.js";
import type { ScraperRegistry } from "../../../application/ports/scraper-registry.js";
import type { ScraperSelectionPolicy } from "../../../application/ports/scraper-selection-policy.js";

import {
  ScraperOrchestrationError,
  ScraperOrchestrator,
} from "./scraper-orchestrator.js";

function createScraper(
  id: string,
  execute: Scraper["execute"],
  capabilities: readonly string[] = ["http"]
): Scraper {
  return {
    id,
    descriptor: {
      scraperId: id,
      capabilities: capabilities as never,
    },
    execute,
  };
}

function createRegistry(
  scrapers: readonly Scraper[]
): ScraperRegistry {
  return {
    register() {},
    getAll() {
      return [...scrapers];
    },
    findByCapabilities(requiredCapabilities) {
      return scrapers.filter((scraper) =>
        requiredCapabilities.every((capability) =>
          scraper.descriptor.capabilities.includes(capability)
        )
      );
    },
    findById(scraperId) {
      return (
        scrapers.find((scraper) => scraper.id === scraperId) ??
        null
      );
    },
  };
}

const preserveOrderPolicy: ScraperSelectionPolicy = {
  select(_request, candidates, failures) {
    const failed = new Set(
      failures.map((failure) => failure.scraperId)
    );

    return candidates.filter(
      (candidate) => !failed.has(candidate.id)
    );
  },
};

test("orchestrator returns the first successful scraper result", async () => {
  const first = createScraper("first", async () => ({
    url: "https://example.com",
    statusCode: 200,
    content: "first",
    contentType: "text/html",
  }));

  const second = createScraper("second", async () => ({
    url: "https://example.com",
    statusCode: 200,
    content: "second",
    contentType: "text/html",
  }));

  const orchestrator = new ScraperOrchestrator(
    createRegistry([first, second]),
    preserveOrderPolicy
  );

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "first");
  assert.equal(result.result.content, "first");
  assert.deepEqual(result.failures, []);
});

test("orchestrator falls back after a scraper failure", async () => {
  const first = createScraper("first", async () => {
    throw new Error("failed");
  });

  const second = createScraper("second", async () => ({
    url: "https://example.com",
    statusCode: 200,
    content: "second",
    contentType: "text/html",
  }));

  const orchestrator = new ScraperOrchestrator(
    createRegistry([first, second]),
    preserveOrderPolicy
  );

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "second");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.scraperId, "first");
});

test("orchestrator uses policy ordering after failure", async () => {
  const http = createScraper(
    "http",
    async () => ({
      url: "https://example.com",
      statusCode: 403,
      content: "blocked",
      contentType: "text/html",
    }),
    ["http"]
  );

  const browser = createScraper(
    "browser",
    async () => ({
      url: "https://example.com",
      statusCode: 200,
      content: "browser",
      contentType: "text/html",
    }),
    ["browser"]
  );

  const antiBot = createScraper(
    "anti-bot",
    async () => ({
      url: "https://example.com",
      statusCode: 200,
      content: "anti-bot",
      contentType: "text/html",
    }),
    ["browser", "anti-bot"]
  );

  const policy: ScraperSelectionPolicy = {
    select(_request, candidates, failures) {
      if (
        failures.some(
          (failure) => failure.reason === "blocked"
        )
      ) {
        return candidates
          .filter(
            (candidate) =>
              !failures.some(
                (failure) =>
                  failure.scraperId === candidate.id
              )
          )
          .sort((left, right) => {
            const leftScore = left.descriptor.capabilities.includes(
              "anti-bot"
            )
              ? 100
              : left.descriptor.capabilities.includes(
                    "browser"
                  )
                ? 50
                : 0;

            const rightScore = right.descriptor.capabilities.includes(
              "anti-bot"
            )
              ? 100
              : right.descriptor.capabilities.includes(
                    "browser"
                  )
                ? 50
                : 0;

            return rightScore - leftScore;
          });
      }

      return candidates;
    },
  };

  const orchestrator = new ScraperOrchestrator(
    createRegistry([http, browser, antiBot]),
    policy
  );

  const result = await orchestrator.execute({
    url: "https://example.com",
  });

  assert.equal(result.scraperId, "anti-bot");
  assert.equal(result.failures[0]?.reason, "blocked");
});

test("orchestrator skips scrapers that do not satisfy required capabilities", async () => {
  let httpCalled = false;

  const http = createScraper(
    "http",
    async () => {
      httpCalled = true;

      return {
        url: "https://example.com",
        statusCode: 200,
        content: "http",
        contentType: "text/html",
      };
    },
    ["http"]
  );

  const browser = createScraper(
    "browser",
    async () => ({
      url: "https://example.com",
      statusCode: 200,
      content: "browser",
      contentType: "text/html",
    }),
    ["browser"]
  );

  const orchestrator = new ScraperOrchestrator(
    createRegistry([http, browser]),
    preserveOrderPolicy
  );

  const result = await orchestrator.execute({
    url: "https://example.com",
    requiredCapabilities: ["browser"],
  });

  assert.equal(httpCalled, false);
  assert.equal(result.scraperId, "browser");
});

test("orchestrator throws when no scraper satisfies capabilities", async () => {
  const http = createScraper(
    "http",
    async () => ({
      url: "https://example.com",
      statusCode: 200,
      content: "http",
      contentType: "text/html",
    }),
    ["http"]
  );

  const orchestrator = new ScraperOrchestrator(
    createRegistry([http]),
    preserveOrderPolicy
  );

  await assert.rejects(
    () =>
      orchestrator.execute({
        url: "https://example.com",
        requiredCapabilities: ["browser"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ScraperOrchestrationError);
      assert.equal(error.failures.length, 0);
      return true;
    }
  );
});
