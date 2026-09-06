import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import type {
  Scraper,
  ScrapeResult,
} from "../../../application/ports/scraper.js";

import { ScraperRegistry } from "./scraper-registry.js";
import { ScraperOrchestrator } from "./scraper-orchestrator.js";
import { DefaultScraperSelectionPolicy } from "./default-scraper-selection-policy.js";
import { HttpScraper } from "./http-scraper.js";
import { BrowserScraper } from "./browser-scraper.js";

test("HTTP scraper succeeds without invoking BrowserScraper", async () => {
  let browserExecuted = false;

  const httpScraper = new HttpScraper();

  const browserScraper: Scraper = {
    id: "browser-test-double",
    descriptor: {
      scraperId: "browser-test-double",
      capabilities: ["browser", "javascript"],
    },
    async execute(): Promise<ScrapeResult> {
      browserExecuted = true;

      return {
        url: "http://unused",
        statusCode: 200,
        content: "browser",
        contentType: "text/html",
      };
    },
  };

  const registry = new ScraperRegistry();
  registry.register(httpScraper);
  registry.register(browserScraper);

  const orchestrator = new ScraperOrchestrator(
    registry,
    new DefaultScraperSelectionPolicy()
  );

  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
    });

    response.end("<html><body>HTTP success</body></html>");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();

    assert.ok(
      address !== null &&
        typeof address === "object"
    );

    const result = await orchestrator.execute({
      url: `http://127.0.0.1:${address.port}/`,
    });

    assert.equal(result.scraperId, "http-scraper");
    assert.equal(result.result.statusCode, 200);
    assert.match(result.result.content, /HTTP success/);
    assert.equal(result.failures.length, 0);
    assert.equal(browserExecuted, false);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("HTTP blocked response falls back to BrowserScraper", async () => {
  const httpScraper = new HttpScraper();

  const browserFactory = {
    async launch() {
      return {
        async newContext() {
          return {
            async newPage() {
              return {
                async goto() {
                  return {
                    url: () => "http://example.test/",
                    status: () => 200,
                  };
                },

                async content() {
                  return `
                    <html>
                      <body>
                        browser-rendered-content
                      </body>
                    </html>
                  `;
                },

                async evaluate<T>(
                  pageFunction: () => T
                ): Promise<T> {
                  return pageFunction();
                },

                async close() {},
              };
            },

            async close() {},
          };
        },

        async close() {},
      };
    },
  };

  const browserScraper = new BrowserScraper({
    browserFactory,
  });

  const server = createServer((_request, response) => {
    response.writeHead(403, {
      "content-type": "text/html",
    });

    response.end("blocked");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();

    assert.ok(
      address !== null &&
        typeof address === "object"
    );

    const orchestrator = new ScraperOrchestrator(
      [httpScraper, browserScraper],
      new DefaultScraperSelectionPolicy()
    );

    const result = await orchestrator.execute({
      url: `http://127.0.0.1:${address.port}/`,
    });

    assert.equal(result.scraperId, "browser-scraper");
    assert.equal(result.result.statusCode, 200);
    assert.match(
      result.result.content,
      /browser-rendered-content/
    );

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.scraperId, "http-scraper");
    assert.equal(result.failures[0]?.reason, "blocked");
    assert.equal(result.failures[0]?.statusCode, 403);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test("JavaScript capability requirement selects BrowserScraper", async () => {
  let httpExecuted = false;

  const httpScraper: Scraper = {
    id: "http-test-double",
    descriptor: {
      scraperId: "http-test-double",
      capabilities: ["http"],
    },
    async execute(): Promise<ScrapeResult> {
      httpExecuted = true;

      return {
        url: "http://unused",
        statusCode: 200,
        content: "http",
        contentType: "text/html",
      };
    },
  };

  const browserScraper = new BrowserScraper({
    browserFactory: {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return {
                  async goto() {
                    return {
                      url: () => "http://example.test/",
                      status: () => 200,
                    };
                  },

                  async content() {
                    return "javascript result";
                  },

                  async evaluate<T>(
                    pageFunction: () => T
                  ): Promise<T> {
                    return pageFunction();
                  },

                  async close() {},
                };
              },

              async close() {},
            };
          },

          async close() {},
        };
      },
    },
  });

  const orchestrator = new ScraperOrchestrator([
    httpScraper,
    browserScraper,
  ]);

  const result = await orchestrator.execute({
    url: "https://example.com",
    requiredCapabilities: ["javascript"],
  });

  assert.equal(result.scraperId, "browser-scraper");
  assert.equal(result.result.content, "javascript result");
  assert.equal(result.failures.length, 0);
  assert.equal(httpExecuted, false);
});

test("BrowserScraper can render JavaScript after HTTP fallback", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(403, {
      "content-type": "text/html",
    });

    response.end("HTTP scraper blocked");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();

    assert.ok(
      address !== null &&
        typeof address === "object"
    );

    const browserScraper = new BrowserScraper();

    const browserFactory = {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return {
                  async goto() {
                    return {
                      url: () =>
                        `http://127.0.0.1:${address.port}/`,
                      status: () => 200,
                    };
                  },

                  async content() {
                    return `
                      <html>
                        <body>
                          <script>
                            document.body.innerHTML =
                              "rendered-after-fallback";
                          </script>
                          rendered-after-fallback
                        </body>
                      </html>
                    `;
                  },

                  async evaluate<T>(
                    pageFunction: () => T
                  ): Promise<T> {
                    return pageFunction();
                  },

                  async close() {},
                };
              },

              async close() {},
            };
          },

          async close() {},
        };
      },
    };

    const browser = new BrowserScraper({
      browserFactory,
    });

    const orchestrator = new ScraperOrchestrator([
      new HttpScraper(),
      browser,
    ]);

    const result = await orchestrator.execute({
      url: `http://127.0.0.1:${address.port}/`,
    });

    assert.equal(result.scraperId, "browser-scraper");
    assert.equal(result.result.statusCode, 200);
    assert.match(
      result.result.content,
      /rendered-after-fallback/
    );

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]?.reason, "blocked");

    void browserScraper;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
