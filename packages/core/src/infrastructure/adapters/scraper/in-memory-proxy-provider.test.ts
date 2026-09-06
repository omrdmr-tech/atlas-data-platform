import { test } from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryProxyProvider,
} from "./in-memory-proxy-provider.js";

test("proxy provider rotates proxies", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
      {
        id: "proxy-2",
        url: "http://proxy-2.test:8080",
      },
    ]);

  const first = await provider.acquire();
  const second = await provider.acquire();

  assert.equal(first?.id, "proxy-1");
  assert.equal(second?.id, "proxy-2");
});

test("failed proxy is excluded after network failure", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
      {
        id: "proxy-2",
        url: "http://proxy-2.test:8080",
      },
    ]);

  const first = await provider.acquire();

  assert.equal(first?.id, "proxy-1");

  await provider.reportFailure(
    "proxy-1",
    "network-error"
  );

  const second = await provider.acquire();

  assert.equal(second?.id, "proxy-2");

  const third = await provider.acquire();

  assert.equal(third?.id, "proxy-2");
});

test("all unavailable proxies return null", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  await provider.reportFailure(
    "proxy-1",
    "blocked"
  );

  const proxy = await provider.acquire();

  assert.equal(proxy, null);
});

test("successful proxy remains available", async () => {
  const provider =
    new InMemoryProxyProvider([
      {
        id: "proxy-1",
        url: "http://proxy-1.test:8080",
      },
    ]);

  const first = await provider.acquire();

  assert.equal(first?.id, "proxy-1");

  await provider.reportSuccess("proxy-1");

  const second = await provider.acquire();

  assert.equal(second?.id, "proxy-1");
});

test("provider rejects duplicate proxy ids", () => {
  assert.throws(
    () =>
      new InMemoryProxyProvider([
        {
          id: "proxy-1",
          url: "http://proxy-1.test:8080",
        },
        {
          id: "proxy-1",
          url: "http://proxy-duplicate.test:8080",
        },
      ]),
    /already registered/
  );
});
