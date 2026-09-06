import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import {
  BrowserScraper,
  type BrowserFactory,
} from "./browser-scraper.js";

test("BrowserScraper renders JavaScript with real Playwright", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
    });

    response.end(`
      <!doctype html>
      <html>
        <body>
          <div id="app">initial</div>
          <script>
            document.getElementById("app").textContent =
              "javascript-rendered";
          </script>
        </body>
      </html>
    `);
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

    const scraper = new BrowserScraper();

    const result = await scraper.execute({
      url: `http://127.0.0.1:${address.port}/`,
    });

    assert.equal(result.statusCode, 200);
    assert.match(result.content, /javascript-rendered/);
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

test("BrowserScraper uses the configured timeout", async () => {
  const scraper = new BrowserScraper({
    timeoutMs: 100,
    browserFactory: {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return {
                  async goto() {
                    throw new Error("navigation timeout");
                  },

                  async content() {
                    return "<html></html>";
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
    } satisfies BrowserFactory,
  });

  await assert.rejects(
    scraper.execute({
      url: "https://example.com",
    }),
    /navigation timeout/
  );
});

test("BrowserScraper closes browser resources after navigation failure", async () => {
  let pageClosed = false;
  let contextClosed = false;
  let browserClosed = false;

  const scraper = new BrowserScraper({
    browserFactory: {
      async launch() {
        return {
          async newContext() {
            return {
              async newPage() {
                return {
                  async goto() {
                    throw new Error("navigation failed");
                  },

                  async content() {
                    return "";
                  },

                  async evaluate<T>(
                    pageFunction: () => T
                  ): Promise<T> {
                    return pageFunction();
                  },

                  async close() {
                    pageClosed = true;
                  },
                };
              },

              async close() {
                contextClosed = true;
              },
            };
          },

          async close() {
            browserClosed = true;
          },
        };
      },
    } satisfies BrowserFactory,
  });

  await assert.rejects(
    scraper.execute({
      url: "https://example.com",
    }),
    /navigation failed/
  );

  assert.equal(pageClosed, true);
  assert.equal(contextClosed, true);
  assert.equal(browserClosed, true);
});
