import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  ProxyFailureReason,
  ProxyProvider,
} from "../../../application/ports/proxy-provider.js";

import {
  ProxyScraper,
} from "./proxy-scraper.js";

test("ProxyScraper exposes proxy capability", () => {
  const provider: ProxyProvider = {
    async acquire() {
      return null;
    },

    async reportSuccess() {},

    async reportFailure() {},
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute() {
          throw new Error("not expected");
        },
      }
    );

  assert.equal(
    scraper.id,
    "proxy-scraper"
  );

  assert.deepEqual(
    scraper.descriptor.capabilities,
    ["http", "proxy"]
  );
});

test("ProxyScraper sends request through selected proxy", async () => {
  const provider: ProxyProvider = {
    async acquire() {
      return {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      };
    },

    async reportSuccess() {},

    async reportFailure() {},
  };

  let usedProxyId: string | null = null;

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          usedProxyId =
            request.proxy.id;

          return {
            url: request.url,
            statusCode: 200,
            content: "ok",
            contentType: "text/plain",
          };
        },
      }
    );

  const result =
    await scraper.execute({
      url: "https://example.com",
    });

  assert.equal(
    usedProxyId,
    "proxy-1"
  );

  assert.equal(
    result.statusCode,
    200
  );
});

test("ProxyScraper reports successful proxy", async () => {
  let successfulProxy: string | null = null;

  const provider: ProxyProvider = {
    async acquire() {
      return {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      };
    },

    async reportSuccess(proxyId) {
      successfulProxy = proxyId;
    },

    async reportFailure() {},
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          return {
            url: request.url,
            statusCode: 200,
            content: "ok",
            contentType: "text/plain",
          };
        },
      }
    );

  await scraper.execute({
    url: "https://example.com",
  });

  assert.equal(
    successfulProxy,
    "proxy-1"
  );
});

test("ProxyScraper rotates to another proxy after rate limiting", async () => {
  const failures: {
    proxyId: string;
    reason: ProxyFailureReason;
  }[] = [];

  let acquisitionIndex = 0;

  const proxies = [
    {
      id: "proxy-1",
      url: "http://proxy-1.test:8080",
    },
    {
      id: "proxy-2",
      url: "http://proxy-2.test:8080",
    },
  ];

  const provider: ProxyProvider = {
    async acquire() {
      const proxy =
        proxies[acquisitionIndex++];

      return proxy ?? null;
    },

    async reportSuccess() {},

    async reportFailure(
      proxyId,
      reason
    ) {
      failures.push({
        proxyId,
        reason,
      });
    },
  };

  const usedProxies: string[] = [];

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          usedProxies.push(
            request.proxy.id
          );

          if (
            request.proxy.id ===
            "proxy-1"
          ) {
            return {
              url: request.url,
              statusCode: 429,
              content: "rate limited",
              contentType: "text/plain",
            };
          }

          return {
            url: request.url,
            statusCode: 200,
            content: "success",
            contentType: "text/plain",
          };
        },
      }
    );

  const result =
    await scraper.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.statusCode,
    200
  );

  assert.deepEqual(
    usedProxies,
    [
      "proxy-1",
      "proxy-2",
    ]
  );

  assert.deepEqual(
    failures,
    [
      {
        proxyId: "proxy-1",
        reason: "rate-limited",
      },
    ]
  );
});

test("ProxyScraper rotates after network failure", async () => {
  const failures: {
    proxyId: string;
    reason: ProxyFailureReason;
  }[] = [];

  let acquisitionIndex = 0;

  const proxies = [
    {
      id: "proxy-1",
      url: "http://proxy-1.test:8080",
    },
    {
      id: "proxy-2",
      url: "http://proxy-2.test:8080",
    },
  ];

  const provider: ProxyProvider = {
    async acquire() {
      const proxy =
        proxies[acquisitionIndex++];

      return proxy ?? null;
    },

    async reportSuccess() {},

    async reportFailure(
      proxyId,
      reason
    ) {
      failures.push({
        proxyId,
        reason,
      });
    },
  };

  const usedProxies: string[] = [];

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          usedProxies.push(
            request.proxy.id
          );

          if (
            request.proxy.id ===
            "proxy-1"
          ) {
            throw new TypeError(
              "network failure"
            );
          }

          return {
            url: request.url,
            statusCode: 200,
            content: "success",
            contentType: "text/plain",
          };
        },
      }
    );

  const result =
    await scraper.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.statusCode,
    200
  );

  assert.deepEqual(
    usedProxies,
    [
      "proxy-1",
      "proxy-2",
    ]
  );

  assert.deepEqual(
    failures,
    [
      {
        proxyId: "proxy-1",
        reason: "network-error",
      },
    ]
  );
});

test("ProxyScraper preserves final HTTP failure after retry attempts", async () => {
  const failures: {
    proxyId: string;
    reason: ProxyFailureReason;
  }[] = [];

  let acquisitionIndex = 0;

  const proxies = [
    {
      id: "proxy-1",
      url: "http://proxy-1.test:8080",
    },
    {
      id: "proxy-2",
      url: "http://proxy-2.test:8080",
    },
  ];

  const provider: ProxyProvider = {
    async acquire() {
      const proxy =
        proxies[acquisitionIndex++];

      return proxy ?? null;
    },

    async reportSuccess() {},

    async reportFailure(
      proxyId,
      reason
    ) {
      failures.push({
        proxyId,
        reason,
      });
    },
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          return {
            url: request.url,
            statusCode: 503,
            content: "unavailable",
            contentType: "text/plain",
          };
        },
      },
      {
        maxAttempts: 2,
      }
    );

  const result =
    await scraper.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.statusCode,
    503
  );

  assert.deepEqual(
    failures,
    [
      {
        proxyId: "proxy-1",
        reason: "server-error",
      },
      {
        proxyId: "proxy-2",
        reason: "server-error",
      },
    ]
  );
});

test("ProxyScraper reports blocked proxy", async () => {
  let reportedReason:
    | ProxyFailureReason
    | null = null;

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
      reportedReason = reason;
    },
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute(request) {
          return {
            url: request.url,
            statusCode: 403,
            content: "blocked",
            contentType: "text/plain",
          };
        },
      },
      {
        maxAttempts: 1,
      }
    );

  const result =
    await scraper.execute({
      url: "https://example.com",
    });

  assert.equal(
    result.statusCode,
    403
  );

  assert.equal(
    reportedReason,
    "blocked"
  );
});

test("ProxyScraper reports network failure", async () => {
  let reportedReason:
    | ProxyFailureReason
    | null = null;

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
      reportedReason = reason;
    },
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute() {
          throw new TypeError(
            "network failure"
          );
        },
      },
      {
        maxAttempts: 1,
      }
    );

  await assert.rejects(
    () =>
      scraper.execute({
        url: "https://example.com",
      }),
    TypeError
  );

  assert.equal(
    reportedReason,
    "network-error"
  );
});

test("ProxyScraper rejects unsupported protocols", async () => {
  const provider: ProxyProvider = {
    async acquire() {
      return {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      };
    },

    async reportSuccess() {},

    async reportFailure() {},
  };

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute() {
          throw new Error("not expected");
        },
      }
    );

  await assert.rejects(
    () =>
      scraper.execute({
        url: "ftp://example.com",
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

  const scraper =
    new ProxyScraper(
      provider,
      {
        async execute() {
          throw new Error("not expected");
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

test("ProxyScraper validates maximum attempts", () => {
  const provider: ProxyProvider = {
    async acquire() {
      return null;
    },

    async reportSuccess() {},

    async reportFailure() {},
  };

  const transport = {
    async execute() {
      throw new Error("not expected");
    },
  };

  assert.throws(
    () =>
      new ProxyScraper(
        provider,
        transport,
        {
          maxAttempts: 0,
        }
      ),
    /positive integer/
  );

  assert.throws(
    () =>
      new ProxyScraper(
        provider,
        transport,
        {
          maxAttempts: 1.5,
        }
      ),
    /positive integer/
  );
});
