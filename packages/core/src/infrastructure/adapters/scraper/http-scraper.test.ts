import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpScraper } from "./http-scraper.js";

function createResponse(options: {
  url: string;
  status: number;
  content: string;
  contentType?: string | null;
}): Response {
  const response = new Response(options.content, {
    status: options.status,
    headers: options.contentType
      ? {
          "content-type": options.contentType,
        }
      : undefined,
  });

  Object.defineProperty(response, "url", {
    value: options.url,
  });

  return response;
}

test("HttpScraper exposes its scraper descriptor", () => {
  const scraper = new HttpScraper();

  assert.equal(scraper.id, "http-scraper");
  assert.equal(scraper.descriptor.scraperId, "http-scraper");
  assert.deepEqual(scraper.descriptor.capabilities, ["http"]);
});

test("HttpScraper executes a successful HTTP request", async () => {
  let requestedUrl = "";
  let requestedUserAgent = "";

  const scraper = new HttpScraper({
    userAgent: "AtlasTest/1.0",
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      requestedUserAgent = String(
        new Headers(init?.headers).get("user-agent")
      );

      return createResponse({
        url: "https://example.com/article",
        status: 200,
        content: "<html>Atlas</html>",
        contentType: "text/html; charset=utf-8",
      });
    },
  });

  const result = await scraper.execute({
    url: "https://example.com/article",
  });

  assert.equal(requestedUrl, "https://example.com/article");
  assert.equal(requestedUserAgent, "AtlasTest/1.0");
  assert.equal(result.url, "https://example.com/article");
  assert.equal(result.statusCode, 200);
  assert.equal(result.content, "<html>Atlas</html>");
  assert.equal(result.contentType, "text/html; charset=utf-8");
});

test("HttpScraper preserves HTTP error status codes", async () => {
  const scraper = new HttpScraper({
    fetcher: async () =>
      createResponse({
        url: "https://example.com/missing",
        status: 404,
        content: "Not Found",
        contentType: "text/plain",
      }),
  });

  const result = await scraper.execute({
    url: "https://example.com/missing",
  });

  assert.equal(result.statusCode, 404);
  assert.equal(result.content, "Not Found");
  assert.equal(result.contentType, "text/plain");
});

test("HttpScraper follows redirects through fetch configuration", async () => {
  let redirectMode: RequestRedirect | undefined;

  const scraper = new HttpScraper({
    fetcher: async (_input, init) => {
      redirectMode = init?.redirect;

      return createResponse({
        url: "https://example.com/final",
        status: 200,
        content: "<html>Final</html>",
        contentType: "text/html",
      });
    },
  });

  const result = await scraper.execute({
    url: "https://example.com/start",
  });

  assert.equal(redirectMode, "follow");
  assert.equal(result.url, "https://example.com/final");
});

test("HttpScraper rejects unsupported URL protocols", async () => {
  const scraper = new HttpScraper({
    fetcher: async () => {
      throw new Error("fetch should not be called");
    },
  });

  await assert.rejects(
    scraper.execute({
      url: "ftp://example.com/file",
    }),
    {
      message: "Only HTTP and HTTPS URLs are supported.",
    }
  );
});

test("HttpScraper propagates fetch errors", async () => {
  const error = new Error("network failure");

  const scraper = new HttpScraper({
    fetcher: async () => {
      throw error;
    },
  });

  await assert.rejects(
    scraper.execute({
      url: "https://example.com/article",
    }),
    error
  );
});

test("HttpScraper aborts a request after the configured timeout", async () => {
  let aborted = false;

  const scraper = new HttpScraper({
    timeoutMs: 10,
    fetcher: async (_input, init) => {
      await new Promise<void>((resolve) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve();
          },
          { once: true }
        );
      });

      throw new DOMException(
        "The operation was aborted.",
        "AbortError"
      );
    },
  });

  await assert.rejects(
    scraper.execute({
      url: "https://example.com/slow",
    }),
    {
      name: "AbortError",
    }
  );

  assert.equal(aborted, true);
});

test("HttpScraper uses the default User-Agent when none is configured", async () => {
  let userAgent = "";

  const scraper = new HttpScraper({
    fetcher: async (_input, init) => {
      userAgent = String(
        new Headers(init?.headers).get("user-agent")
      );

      return createResponse({
        url: "https://example.com/article",
        status: 200,
        content: "ok",
        contentType: "text/html",
      });
    },
  });

  await scraper.execute({
    url: "https://example.com/article",
  });

  assert.equal(userAgent, "AtlasScraper/0.1");
});
