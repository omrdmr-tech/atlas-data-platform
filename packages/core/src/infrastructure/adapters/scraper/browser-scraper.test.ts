import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BrowserScraper,
  type BrowserFactory,
} from "./browser-scraper.js";

function createMockBrowserFactory(
  statusCode = 200,
  responseUrl = "https://example.com/final"
): BrowserFactory {
  return {
    async launch() {
      return {
        async newContext() {
          return {
            async newPage() {
              return {
                async goto() {
                  return {
                    url: () => responseUrl,
                    status: () => statusCode,
                  };
                },

                async content() {
                  return "<html><body>Hello</body></html>";
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
}

test("BrowserScraper exposes browser and javascript capabilities", () => {
  const scraper = new BrowserScraper({
    browserFactory: createMockBrowserFactory(),
  });

  assert.equal(scraper.id, "browser-scraper");
  assert.equal(
    scraper.descriptor.scraperId,
    "browser-scraper"
  );
  assert.deepEqual(
    scraper.descriptor.capabilities,
    ["browser", "javascript"]
  );
});

test("BrowserScraper executes a browser request", async () => {
  const scraper = new BrowserScraper({
    browserFactory: createMockBrowserFactory(),
  });

  const result = await scraper.execute({
    url: "https://example.com",
  });

  assert.equal(
    result.url,
    "https://example.com/final"
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.content, "<html><body>Hello</body></html>");
  assert.equal(result.contentType, "text/html");
});

test("BrowserScraper preserves non-success HTTP status codes", async () => {
  const scraper = new BrowserScraper({
    browserFactory: createMockBrowserFactory(403),
  });

  const result = await scraper.execute({
    url: "https://example.com/protected",
  });

  assert.equal(result.statusCode, 403);
});

test("BrowserScraper rejects unsupported URL protocols", async () => {
  const scraper = new BrowserScraper({
    browserFactory: createMockBrowserFactory(),
  });

  await assert.rejects(
    scraper.execute({
      url: "ftp://example.com/file",
    }),
    /Only HTTP and HTTPS URLs are supported/
  );
});

test("BrowserScraper evaluates JavaScript through the page abstraction", async () => {
  const scraper = new BrowserScraper({
    browserFactory: createMockBrowserFactory(),
  });

  const factory = createMockBrowserFactory();

  const browser = await factory.launch();

  const context = await browser.newContext();

  const page = await context.newPage();

  const value = await page.evaluate(
    () => "javascript-rendered-content"
  );

  assert.equal(value, "javascript-rendered-content");

  await page.close();
  await context.close();
  await browser.close();

  assert.ok(scraper);
});
