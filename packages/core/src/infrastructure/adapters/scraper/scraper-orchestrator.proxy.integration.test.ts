import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ProxyProvider,
  ProxyFailureReason,
} from "../../../application/ports/proxy-provider.js";

import type {
  ProxyTransport,
  ProxyTransportRequest,
} from "../../../application/ports/proxy-transport.js";

import {
  ScraperOrchestrator,
} from "./scraper-orchestrator.js";

import {
  HttpScraper,
} from "./http-scraper.js";

import {
  BrowserScraper,
} from "./browser-scraper.js";

import {
  ProxyScraper,
} from "./proxy-scraper.js";

import {
  InMemoryProxyProvider,
} from "./in-memory-proxy-provider.js";

function createProxyTransport(
  handler: (
    request: ProxyTransportRequest
  ) => Promise<{
    readonly url: string;
    readonly statusCode: number;
    readonly content: string;
    readonly contentType: string | null;
  }>
): ProxyTransport {
  return {
    execute: handler,
  };
}

test("HTTP 429 falls back to ProxyScraper", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  let proxyUsed = false;

  const transport = createProxyTransport(
    async (request) => {
      proxyUsed = true;

      assert.equal(
        request.proxy.id,
        "proxy-1"
      );

      return {
        url: request.url,
        statusCode: 200,
        content: "proxy-success",
        contentType: "text/html",
      };
    }
  );

  const proxyScraper = new ProxyScraper(
    provider,
    transport
  );

  const httpScraper = new HttpScraper({
    fetcher: async () =>
      new Response(
        "rate limited",
        {
          status: 429,
          headers: {
            "content-type": "text/plain",
          },
        }
      ),
  });

  const orchestrator =
    new ScraperOrchestrator([
      httpScraper,
      proxyScraper,
    ]);

  const result =
    await orchestrator.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.scraperId,
    "proxy-scraper"
  );

  assert.equal(
    result.result.statusCode,
    200
  );

  assert.equal(
    result.result.content,
    "proxy-success"
  );

  assert.equal(
    proxyUsed,
    true
  );

  assert.equal(
    result.failures.length,
    1
  );

  assert.equal(
    result.failures[0]?.scraperId,
    "http-scraper"
  );

  assert.equal(
    result.failures[0]?.reason,
    "rate-limited"
  );

  assert.equal(
    result.failures[0]?.statusCode,
    429
  );
});

test("network failure falls back to ProxyScraper", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  let proxyUsed = false;

  const transport =
    createProxyTransport(
      async (request) => {
        proxyUsed = true;

        assert.equal(
          request.proxy.id,
          "proxy-1"
        );

        return {
          url: request.url,
          statusCode: 200,
          content: "network-recovered",
          contentType: "text/html",
        };
      }
    );

  const proxyScraper =
    new ProxyScraper(
      provider,
      transport
    );

  const httpScraper =
    new HttpScraper({
      fetcher: async () => {
        throw new TypeError(
          "network unavailable"
        );
      },
    });

  const orchestrator =
    new ScraperOrchestrator([
      httpScraper,
      proxyScraper,
    ]);

  const result =
    await orchestrator.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.scraperId,
    "proxy-scraper"
  );

  assert.equal(
    result.result.content,
    "network-recovered"
  );

  assert.equal(
    proxyUsed,
    true
  );

  assert.equal(
    result.failures.length,
    1
  );

  assert.equal(
    result.failures[0]?.reason,
    "network-error"
  );
});

test("HTTP 403 prefers BrowserScraper before ProxyScraper", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  const executionOrder: string[] = [];

  const proxyScraper =
    new ProxyScraper(
      provider,
      createProxyTransport(
        async (request) => {
          executionOrder.push(
            `proxy:${request.proxy.id}`
          );

          return {
            url: request.url,
            statusCode: 200,
            content: "proxy-success",
            contentType: "text/html",
          };
        }
      )
    );

  const browserScraper =
    new BrowserScraper({
      browserFactory: {
        async launch() {
          executionOrder.push(
            "browser"
          );

          return {
            async newContext() {
              return {
                async newPage() {
                  return {
                    async goto() {
                      return {
                        url: () =>
                          "https://example.com",
                        status: () => 200,
                      };
                    },

                    async content() {
                      executionOrder.push(
                        "browser-content"
                      );

                      return "browser-success";
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

  const httpScraper =
    new HttpScraper({
      fetcher: async () =>
        new Response(
          "blocked",
          {
            status: 403,
            headers: {
              "content-type":
                "text/plain",
            },
          }
        ),
    });

  const orchestrator =
    new ScraperOrchestrator([
      httpScraper,
      browserScraper,
      proxyScraper,
    ]);

  const result =
    await orchestrator.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.scraperId,
    "browser-scraper"
  );

  assert.equal(
    result.result.content,
    "browser-success"
  );

  assert.deepEqual(
    executionOrder,
    [
      "browser",
      "browser-content",
    ]
  );

  assert.equal(
    result.failures.length,
    1
  );

  assert.equal(
    result.failures[0]?.reason,
    "blocked"
  );
});

test("Browser failure after HTTP 403 falls back to ProxyScraper", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  const executionOrder: string[] = [];

  const httpScraper =
    new HttpScraper({
      fetcher: async () =>
        new Response(
          "blocked",
          {
            status: 403,
          }
        ),
    });

  const browserScraper =
    new BrowserScraper({
      browserFactory: {
        async launch() {
          executionOrder.push(
            "browser"
          );

          return {
            async newContext() {
              return {
                async newPage() {
                  return {
                    async goto() {
                      throw new Error(
                        "browser navigation failed"
                      );
                    },

                    async content() {
                      return "unreachable";
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

  const proxyScraper =
    new ProxyScraper(
      provider,
      createProxyTransport(
        async (request) => {
          executionOrder.push(
            `proxy:${request.proxy.id}`
          );

          return {
            url: request.url,
            statusCode: 200,
            content:
              "proxy-recovered",
            contentType: "text/html",
          };
        }
      )
    );

  const orchestrator =
    new ScraperOrchestrator([
      httpScraper,
      browserScraper,
      proxyScraper,
    ]);

  const result =
    await orchestrator.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.scraperId,
    "proxy-scraper"
  );

  assert.equal(
    result.result.content,
    "proxy-recovered"
  );

  assert.deepEqual(
    executionOrder,
    [
      "browser",
      "proxy:proxy-1",
    ]
  );

  assert.equal(
    result.failures.length,
    2
  );

  assert.equal(
    result.failures[0]?.scraperId,
    "http-scraper"
  );

  assert.equal(
    result.failures[0]?.reason,
    "blocked"
  );

  assert.equal(
    result.failures[1]?.scraperId,
    "browser-scraper"
  );

  assert.equal(
    result.failures[1]?.reason,
    "unknown"
  );
});

test("all scraper failures are preserved across HTTP Browser and Proxy", async () => {
  const failureReasons: ProxyFailureReason[] =
    [];

  const provider: ProxyProvider = {
    async acquire() {
      return {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      };
    },

    async reportSuccess() {},

    async reportFailure(
      _proxyId,
      reason
    ) {
      failureReasons.push(reason);
    },
  };

  const httpScraper =
    new HttpScraper({
      fetcher: async () =>
        new Response(
          "rate limited",
          {
            status: 429,
          }
        ),
    });

  const browserScraper =
    new BrowserScraper({
      browserFactory: {
        async launch() {
          return {
            async newContext() {
              return {
                async newPage() {
                  return {
                    async goto() {
                      throw new Error(
                        "browser failed"
                      );
                    },

                    async content() {
                      return "";
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

  const proxyScraper =
    new ProxyScraper(
      provider,
      {
        async execute() {
          return {
            url: "https://example.com",
            statusCode: 503,
            content: "proxy unavailable",
            contentType:
              "text/plain",
          };
        },
      },
      {
        maxAttempts: 1,
      }
    );

  const orchestrator =
    new ScraperOrchestrator([
      httpScraper,
      browserScraper,
      proxyScraper,
    ]);

  await assert.rejects(
    () =>
      orchestrator.execute({
        url: "https://example.com",
      }),
    (error: unknown) => {
      assert.equal(
        error instanceof Error,
        true
      );

      const failures =
        (
          error as {
            failures?: readonly {
              scraperId: string;
              reason: string;
              statusCode: number | null;
            }[];
          }
        ).failures;

      assert.ok(failures);

      assert.equal(
        failures.length,
        3
      );

      assert.deepEqual(
        failures.map(
          (failure) =>
            failure.scraperId
        ),
        [
          "http-scraper",
          "proxy-scraper",
          "browser-scraper",
        ]
      );

      assert.equal(
        failures[0]?.reason,
        "rate-limited"
      );

      assert.equal(
        failures[0]?.statusCode,
        429
      );

      assert.equal(
        failures[1]?.reason,
        "server-error"
      );

      assert.equal(
        failures[1]?.statusCode,
        503
      );

      assert.equal(
        failures[2]?.reason,
        "unknown"
      );

      assert.equal(
        failures[2]?.statusCode,
        null
      );

      return true;
    }
  );

  assert.deepEqual(
    failureReasons,
    ["server-error"]
  );
});


