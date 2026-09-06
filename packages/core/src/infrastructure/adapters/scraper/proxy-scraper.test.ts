import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ProxyEndpoint,
  ProxyProvider,
  ProxyFailureReason,
} from "../../../application/ports/proxy-provider.js";

import type {
  ProxyTransport,
  ProxyTransportRequest,
} from "../../../application/ports/proxy-transport.js";

import {
  ProxyScraper,
} from "./proxy-scraper.js";

function createProvider(
  proxy: ProxyEndpoint
): {
  provider: ProxyProvider;
  calls: {
    success: string[];
    failures: Array<{
      proxyId: string;
      reason: ProxyFailureReason;
    }>;
  };
} {
  const calls = {
    success: [] as string[],
    failures: [] as Array<{
      proxyId: string;
      reason: ProxyFailureReason;
    }>,
  };

  return {
    calls,

    provider: {
      async acquire() {
        return proxy;
      },

      async reportSuccess(proxyId) {
        calls.success.push(proxyId);
      },

      async reportFailure(
        proxyId,
        reason
      ) {
        calls.failures.push({
          proxyId,
          reason,
        });
      },
    },
  };
}

test("ProxyScraper exposes proxy capability", () => {
  const { provider } = createProvider({
    id: "proxy-1",
    url: "http://proxy.test:8080",
  });

  const transport: ProxyTransport = {
    async execute() {
      return {
        url: "https://example.com",
        statusCode: 200,
        content: "ok",
        contentType: "text/html",
      };
    },
  };

  const scraper = new ProxyScraper(
    provider,
    transport
  );

  assert.equal(scraper.id, "proxy-scraper");
  assert.deepEqual(
    scraper.descriptor.capabilities,
    ["http", "proxy"]
  );
});

test("ProxyScraper sends request through selected proxy", async () => {
  const proxy = {
    id: "proxy-1",
    url: "http://proxy.test:8080",
  };

  const { provider } =
    createProvider(proxy);

  let captured:
    | ProxyTransportRequest
    | undefined;

  const transport: ProxyTransport = {
    async execute(request) {
      captured = request;

      return {
        url: request.url,
        statusCode: 200,
        content: "proxy response",
        contentType: "text/html",
      };
    },
  };

  const scraper = new ProxyScraper(
    provider,
    transport
  );

  const result = await scraper.execute({
    url: "https://example.com",
  });

  assert.equal(
    result.content,
    "proxy response"
  );

  assert.equal(
    captured?.proxy.id,
    "proxy-1"
  );

  assert.equal(
    captured?.url,
    "https://example.com"
  );

  assert.equal(
    captured?.init?.headers?.["User-Agent"],
    "AtlasProxyScraper/0.1"
  );
});

test("ProxyScraper reports successful proxy", async () => {
  const { provider, calls } =
    createProvider({
      id: "proxy-1",
      url: "http://proxy.test:8080",
    });

  const scraper = new ProxyScraper(
    provider,
    {
      async execute() {
        return {
          url: "https://example.com",
          statusCode: 200,
          content: "ok",
          contentType: "text/html",
        };
      },
    }
  );

  await scraper.execute({
    url: "https://example.com",
  });

  assert.deepEqual(
    calls.success,
    ["proxy-1"]
  );

  assert.equal(
    calls.failures.length,
    0
  );
});

test("ProxyScraper reports blocked proxy", async () => {
  const { provider, calls } =
    createProvider({
      id: "proxy-1",
      url: "http://proxy.test:8080",
    });

  const scraper = new ProxyScraper(
    provider,
    {
      async execute() {
        return {
          url: "https://example.com",
          statusCode: 403,
          content: "blocked",
          contentType: "text/html",
        };
      },
    }
  );

  const result = await scraper.execute({
    url: "https://example.com",
  });

  assert.equal(
    result.statusCode,
    403
  );

  assert.deepEqual(
    calls.failures,
    [
      {
        proxyId: "proxy-1",
        reason: "blocked",
      },
    ]
  );
});

test("ProxyScraper reports network failure", async () => {
  const { provider, calls } =
    createProvider({
      id: "proxy-1",
      url: "http://proxy.test:8080",
    });

  const scraper = new ProxyScraper(
    provider,
    {
      async execute() {
        throw new TypeError(
          "network failure"
        );
      },
    }
  );

  await assert.rejects(
    () =>
      scraper.execute({
        url: "https://example.com",
      }),
    /network failure/
  );

  assert.deepEqual(
    calls.failures,
    [
      {
        proxyId: "proxy-1",
        reason: "network-error",
      },
    ]
  );
});

test("ProxyScraper rejects unsupported protocols", async () => {
  const { provider } =
    createProvider({
      id: "proxy-1",
      url: "http://proxy.test:8080",
    });

  const scraper = new ProxyScraper(
    provider,
    {
      async execute() {
        throw new Error(
          "should not execute"
        );
      },
    }
  );

  await assert.rejects(
    () =>
      scraper.execute({
        url: "file:///tmp/test.html",
      }),
    /Only HTTP and HTTPS URLs are supported/
  );
});

test("ProxyScraper fails when no proxy is available", async () => {
  const provider: ProxyProvider = {
    async acquire() {
      return null;
    },

    async reportSuccess() {},

    async reportFailure() {},
  };

  const scraper = new ProxyScraper(
    provider,
    {
      async execute() {
        throw new Error(
          "should not execute"
        );
      },
    }
  );

  await assert.rejects(
    () =>
      scraper.execute({
        url: "https://example.com",
      }),
    /No available proxy is configured/
  );
});
