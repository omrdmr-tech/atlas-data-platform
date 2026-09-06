import { test } from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryProxyProvider,
} from "./in-memory-proxy-provider.js";

const proxy1 = {
  id: "proxy-1",
  url: "http://proxy-1.test:8080",
};

const proxy2 = {
  id: "proxy-2",
  url: "http://proxy-2.test:8080",
};

test("proxy provider rotates proxies", async () => {
  const provider =
    new InMemoryProxyProvider([
      proxy1,
      proxy2,
    ]);

  const first = await provider.acquire();
  const second = await provider.acquire();

  assert.equal(first?.id, "proxy-1");
  assert.equal(second?.id, "proxy-2");
});

test("failed proxy enters cooldown after network failure", async () => {
  let now = 1_000;

  const provider =
    new InMemoryProxyProvider(
      [proxy1, proxy2],
      {
        cooldownMs: 10_000,
        now: () => now,
      }
    );

  const first = await provider.acquire();

  assert.equal(first?.id, "proxy-1");

  await provider.reportFailure(
    "proxy-1",
    "network-error"
  );

  const second = await provider.acquire();

  assert.equal(second?.id, "proxy-2");

  now += 5_000;

  const third = await provider.acquire();

  assert.equal(third?.id, "proxy-2");

  now += 5_000;

  const recovered = await provider.acquire();

  assert.equal(recovered?.id, "proxy-1");
});

test("all proxies in cooldown return null", async () => {
  let now = 1_000;

  const provider =
    new InMemoryProxyProvider(
      [proxy1],
      {
        cooldownMs: 10_000,
        now: () => now,
      }
    );

  await provider.reportFailure(
    "proxy-1",
    "blocked"
  );

  const unavailable =
    await provider.acquire();

  assert.equal(unavailable, null);

  now += 10_000;

  const recovered =
    await provider.acquire();

  assert.equal(recovered?.id, "proxy-1");
});

test("successful proxy clears cooldown and resets failures", async () => {
  let now = 1_000;

  const provider =
    new InMemoryProxyProvider(
      [proxy1],
      {
        cooldownMs: 10_000,
        now: () => now,
      }
    );

  const first = await provider.acquire();

  assert.equal(first?.id, "proxy-1");

  await provider.reportFailure(
    "proxy-1",
    "rate-limited"
  );

  assert.equal(
    await provider.acquire(),
    null
  );

  await provider.reportSuccess(
    "proxy-1"
  );

  const second =
    await provider.acquire();

  assert.equal(second?.id, "proxy-1");
});

test("server and HTTP errors do not trigger cooldown", async () => {
  const provider =
    new InMemoryProxyProvider([
      proxy1,
    ]);

  await provider.reportFailure(
    "proxy-1",
    "server-error"
  );

  assert.equal(
    (await provider.acquire())?.id,
    "proxy-1"
  );

  await provider.reportFailure(
    "proxy-1",
    "http-error"
  );

  assert.equal(
    (await provider.acquire())?.id,
    "proxy-1"
  );

  await provider.reportFailure(
    "proxy-1",
    "unknown"
  );

  assert.equal(
    (await provider.acquire())?.id,
    "proxy-1"
  );
});

test("provider rejects invalid cooldown duration", () => {
  assert.throws(
    () =>
      new InMemoryProxyProvider(
        [proxy1],
        {
          cooldownMs: -1,
        }
      ),
    /non-negative finite number/
  );

  assert.throws(
    () =>
      new InMemoryProxyProvider(
        [proxy1],
        {
          cooldownMs: Number.NaN,
        }
      ),
    /non-negative finite number/
  );
});

test("provider rejects duplicate proxy ids", () => {
  assert.throws(
    () =>
      new InMemoryProxyProvider([
        proxy1,
        {
          id: "proxy-1",
          url: "http://proxy-duplicate.test:8080",
        },
      ]),
    /already registered/
  );
});
