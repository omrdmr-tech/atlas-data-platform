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

test("HTTP 200 login page is detected and falls back to BrowserScraper with logs", async () => {
  const httpScraper: Scraper = {
    id: "http-scraper",
    descriptor: {
      scraperId: "http-scraper",
      capabilities: ["http"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: `
          <html>
            <body>
              <h1>Login required</h1>
              <p>Please log in to continue.</p>
            </body>
          </html>
        `,
        contentType: "text/html",
      };
    },
  };

  const browserScraper: Scraper = {
    id: "browser-scraper",
    descriptor: {
      scraperId: "browser-scraper",
      capabilities: ["browser", "javascript"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: "<html><body>Authenticated article content</body></html>",
        contentType: "text/html",
      };
    },
  };

  const processEntries: import("../../../application/ports/process-log.js").ProcessLogEntry[] = [];
  const sourceEntries: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry[] = [];

  const processLog = {
    async append(entry: import("../../../application/ports/process-log.js").ProcessLogEntry) {
      processEntries.push(entry);
    },
    getAll() {
      return processEntries;
    },
    findByRequestId(requestId: string) {
      return processEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
  };

  const sourceAccessLog = {
    async append(entry: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry) {
      sourceEntries.push(entry);
    },
    getAll() {
      return sourceEntries;
    },
    findByRequestId(requestId: string) {
      return sourceEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
    findBySourceId(sourceId: string) {
      return sourceEntries.filter(
        (entry) => entry.sourceId === sourceId
      );
    },
  };

  const orchestrator = new ScraperOrchestrator(
    [httpScraper, browserScraper],
    new DefaultScraperSelectionPolicy(),
    {
      processLog,
      sourceAccessLog,
    }
  );

  const result = await orchestrator.execute({
    url: "https://news.example.com/article",
    requestId: "request-login-001",
    sourceId: "news-example",
  });

  assert.equal(result.scraperId, "browser-scraper");
  assert.equal(result.result.statusCode, 200);
  assert.match(
    result.result.content,
    /Authenticated article content/
  );

  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.scraperId, "http-scraper");
  assert.equal(result.failures[0]?.reason, "blocked");

  assert.equal(processEntries.length, 2);
  assert.equal(sourceEntries.length, 2);

  assert.equal(processEntries[0]?.requestId, "request-login-001");
  assert.equal(processEntries[1]?.requestId, "request-login-001");

  assert.equal(processEntries[0]?.scraperId, "http-scraper");
  assert.equal(processEntries[0]?.status, "failed");
  assert.equal(processEntries[0]?.fallbackUsed, false);

  assert.equal(processEntries[1]?.scraperId, "browser-scraper");
  assert.equal(processEntries[1]?.status, "success");
  assert.equal(processEntries[1]?.fallbackUsed, true);

  assert.equal(sourceEntries[0]?.accessStatus, "login-required");
  assert.equal(sourceEntries[0]?.accessType, "http");
  assert.equal(sourceEntries[0]?.requiresLogin, true);
  assert.equal(sourceEntries[0]?.contentAvailable, false);

  assert.equal(sourceEntries[1]?.accessStatus, "accessible");
  assert.equal(sourceEntries[1]?.accessType, "browser");
  assert.equal(sourceEntries[1]?.contentAvailable, true);
});

test("HTTP 200 subscription page is detected and logged before fallback", async () => {
  const httpScraper: Scraper = {
    id: "http-scraper",
    descriptor: {
      scraperId: "http-scraper",
      capabilities: ["http"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: `
          <html>
            <body>
              <h1>Premium Article</h1>
              <p>This article is for subscribers.</p>
              <p>Subscription required to continue.</p>
            </body>
          </html>
        `,
        contentType: "text/html",
      };
    },
  };

  const browserScraper: Scraper = {
    id: "browser-scraper",
    descriptor: {
      scraperId: "browser-scraper",
      capabilities: ["browser", "javascript"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: "<article>Full premium article</article>",
        contentType: "text/html",
      };
    },
  };

  const processEntries: import("../../../application/ports/process-log.js").ProcessLogEntry[] = [];
  const sourceEntries: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry[] = [];

  const processLog = {
    async append(entry: import("../../../application/ports/process-log.js").ProcessLogEntry) {
      processEntries.push(entry);
    },
    getAll() {
      return processEntries;
    },
    findByRequestId(requestId: string) {
      return processEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
  };

  const sourceAccessLog = {
    async append(entry: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry) {
      sourceEntries.push(entry);
    },
    getAll() {
      return sourceEntries;
    },
    findByRequestId(requestId: string) {
      return sourceEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
    findBySourceId(sourceId: string) {
      return sourceEntries.filter(
        (entry) => entry.sourceId === sourceId
      );
    },
  };

  const orchestrator = new ScraperOrchestrator(
    [httpScraper, browserScraper],
    new DefaultScraperSelectionPolicy(),
    {
      processLog,
      sourceAccessLog,
    }
  );

  const result = await orchestrator.execute({
    url: "https://premium.example.com/article",
    requestId: "request-subscription-001",
    sourceId: "premium-example",
  });

  assert.equal(result.scraperId, "browser-scraper");
  assert.equal(result.result.statusCode, 200);
  assert.match(
    result.result.content,
    /Full premium article/
  );

  assert.equal(processEntries.length, 2);
  assert.equal(sourceEntries.length, 2);

  assert.equal(sourceEntries[0]?.accessStatus, "subscription-required");
  assert.equal(sourceEntries[0]?.requiresSubscription, true);
  assert.equal(sourceEntries[0]?.contentAvailable, false);

  assert.equal(sourceEntries[1]?.accessStatus, "accessible");
  assert.equal(sourceEntries[1]?.contentAvailable, true);

  assert.equal(processEntries[0]?.status, "failed");
  assert.equal(processEntries[0]?.failureReason, "blocked");
  assert.equal(processEntries[1]?.status, "success");
});

test("process log preserves request identity and fallback state across failed attempts", async () => {
  const processEntries: import("../../../application/ports/process-log.js").ProcessLogEntry[] = [];
  const sourceEntries: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry[] = [];

  const first: Scraper = {
    id: "first",
    descriptor: {
      scraperId: "first",
      capabilities: ["http"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 403,
        content: "Forbidden",
        contentType: "text/html",
      };
    },
  };

  const second: Scraper = {
    id: "second",
    descriptor: {
      scraperId: "second",
      capabilities: ["browser"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: "browser success",
        contentType: "text/html",
      };
    },
  };

  const processLog = {
    async append(entry: import("../../../application/ports/process-log.js").ProcessLogEntry) {
      processEntries.push(entry);
    },
    getAll() {
      return processEntries;
    },
    findByRequestId(requestId: string) {
      return processEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
  };

  const sourceAccessLog = {
    async append(entry: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry) {
      sourceEntries.push(entry);
    },
    getAll() {
      return sourceEntries;
    },
    findByRequestId(requestId: string) {
      return sourceEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
    findBySourceId(sourceId: string) {
      return sourceEntries.filter(
        (entry) => entry.sourceId === sourceId
      );
    },
  };

  const orchestrator = new ScraperOrchestrator(
    [first, second],
    new DefaultScraperSelectionPolicy(),
    {
      processLog,
      sourceAccessLog,
    }
  );

  const result = await orchestrator.execute({
    url: "https://example.com/article",
    requestId: "request-fallback-001",
    sourceId: "example-source",
  });

  assert.equal(result.scraperId, "second");
  assert.equal(result.result.content, "browser success");

  assert.equal(processEntries.length, 2);
  assert.equal(
    processEntries[0]?.requestId,
    processEntries[1]?.requestId
  );
  assert.equal(
    processEntries[0]?.requestId,
    "request-fallback-001"
  );

  assert.equal(processEntries[0]?.attempt, 1);
  assert.equal(processEntries[1]?.attempt, 2);

  assert.equal(processEntries[0]?.status, "failed");
  assert.equal(processEntries[0]?.fallbackUsed, false);
  assert.equal(processEntries[0]?.failureReason, "blocked");

  assert.equal(processEntries[1]?.status, "success");
  assert.equal(processEntries[1]?.fallbackUsed, true);

  assert.ok(processEntries[0]?.durationMs >= 0);
  assert.ok(processEntries[1]?.durationMs >= 0);

  assert.equal(sourceEntries.length, 2);
  assert.equal(sourceEntries[0]?.httpStatus, 403);
  assert.equal(sourceEntries[0]?.accessStatus, "bot-blocked");
  assert.equal(sourceEntries[1]?.httpStatus, 200);
  assert.equal(sourceEntries[1]?.accessStatus, "accessible");
});

test("source access log records proxy access type", async () => {
  const sourceEntries: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry[] = [];

  const proxyScraper: Scraper = {
    id: "proxy-scraper",
    descriptor: {
      scraperId: "proxy-scraper",
      capabilities: ["proxy"],
    },
    async execute(request): Promise<ScrapeResult> {
      return {
        url: request.url,
        statusCode: 200,
        content: "<article>Proxy fetched content</article>",
        contentType: "text/html",
      };
    },
  };

  const sourceAccessLog = {
    async append(entry: import("../../../application/ports/source-access-log.js").SourceAccessLogEntry) {
      sourceEntries.push(entry);
    },
    getAll() {
      return sourceEntries;
    },
    findByRequestId(requestId: string) {
      return sourceEntries.filter(
        (entry) => entry.requestId === requestId
      );
    },
    findBySourceId(sourceId: string) {
      return sourceEntries.filter(
        (entry) => entry.sourceId === sourceId
      );
    },
  };

  const orchestrator = new ScraperOrchestrator(
    [proxyScraper],
    new DefaultScraperSelectionPolicy(),
    {
      sourceAccessLog,
    }
  );

  const result = await orchestrator.execute({
    url: "https://example.com/proxy",
    requestId: "request-proxy-001",
    sourceId: "example-source",
  });

  assert.equal(result.scraperId, "proxy-scraper");
  assert.equal(sourceEntries.length, 1);

  assert.equal(sourceEntries[0]?.requestId, "request-proxy-001");
  assert.equal(sourceEntries[0]?.sourceId, "example-source");
  assert.equal(sourceEntries[0]?.accessType, "proxy");
  assert.equal(sourceEntries[0]?.accessStatus, "accessible");
  assert.equal(sourceEntries[0]?.contentAvailable, true);
});
