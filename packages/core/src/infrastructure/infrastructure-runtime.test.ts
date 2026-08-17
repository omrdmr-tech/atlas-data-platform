import { test } from "node:test";
import assert from "node:assert/strict";
import { InfrastructureRuntime } from "./infrastructure-runtime.js";

class FakeDatabase {
  public connected = false;
  public calls: string[] = [];

  public async connect(): Promise<void> {
    this.calls.push("connect");
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.calls.push("disconnect");
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

class FakeCache {
  public connected = false;
  public calls: string[] = [];

  public async connect(): Promise<void> {
    this.calls.push("connect");
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.calls.push("disconnect");
    this.connected = false;
  }
}

class FakeIdempotencyStore {
  public initialized = false;
  public calls: string[] = [];

  public async initialize(): Promise<void> {
    this.calls.push("initialize");
    this.initialized = true;
  }
}

class FakeDispatcher {
  public running = false;
  public calls: string[] = [];

  public start(): void {
    this.calls.push("start");
    this.running = true;
  }

  public async stop(): Promise<void> {
    this.calls.push("stop");
    this.running = false;
  }
}

test(
  "InfrastructureRuntime initializes infrastructure components",
  async () => {
    const database = new FakeDatabase();
    const cache = new FakeCache();
    const idempotencyStore =
      new FakeIdempotencyStore();
    const dispatcher = new FakeDispatcher();

    const runtime = new InfrastructureRuntime({
      database,
      cache,
      idempotencyStore,
      dispatcher
    });

    await runtime.initialize();

    assert.equal(database.connected, true);
    assert.equal(cache.connected, true);
    assert.equal(
      idempotencyStore.initialized,
      true
    );
    assert.equal(dispatcher.running, true);
    assert.equal(runtime.isInitialized, true);

    assert.deepEqual(
      database.calls,
      ["connect"]
    );

    assert.deepEqual(
      cache.calls,
      ["connect"]
    );

    assert.deepEqual(
      idempotencyStore.calls,
      ["initialize"]
    );

    assert.deepEqual(
      dispatcher.calls,
      ["start"]
    );
  }
);

test(
  "InfrastructureRuntime shuts down infrastructure components",
  async () => {
    const database = new FakeDatabase();
    const cache = new FakeCache();
    const idempotencyStore =
      new FakeIdempotencyStore();
    const dispatcher = new FakeDispatcher();

    const runtime = new InfrastructureRuntime({
      database,
      cache,
      idempotencyStore,
      dispatcher
    });

    await runtime.initialize();
    await runtime.shutdown();

    assert.equal(database.connected, false);
    assert.equal(cache.connected, false);
    assert.equal(
      idempotencyStore.initialized,
      true
    );
    assert.equal(dispatcher.running, false);
    assert.equal(runtime.isInitialized, false);

    assert.deepEqual(
      dispatcher.calls,
      ["start", "stop"]
    );

    assert.deepEqual(
      idempotencyStore.calls,
      ["initialize"]
    );

    assert.deepEqual(
      cache.calls,
      ["connect", "disconnect"]
    );

    assert.deepEqual(
      database.calls,
      ["connect", "disconnect"]
    );
  }
);

test(
  "InfrastructureRuntime ignores repeated initialize calls",
  async () => {
    const database = new FakeDatabase();
    const cache = new FakeCache();
    const idempotencyStore =
      new FakeIdempotencyStore();
    const dispatcher = new FakeDispatcher();

    const runtime = new InfrastructureRuntime({
      database,
      cache,
      idempotencyStore,
      dispatcher
    });

    await runtime.initialize();
    await runtime.initialize();

    assert.equal(runtime.isInitialized, true);

    assert.deepEqual(
      database.calls,
      ["connect"]
    );

    assert.deepEqual(
      cache.calls,
      ["connect"]
    );

    assert.deepEqual(
      idempotencyStore.calls,
      ["initialize"]
    );

    assert.deepEqual(
      dispatcher.calls,
      ["start"]
    );
  }
);

test(
  "InfrastructureRuntime ignores repeated shutdown calls",
  async () => {
    const database = new FakeDatabase();
    const cache = new FakeCache();
    const idempotencyStore =
      new FakeIdempotencyStore();
    const dispatcher = new FakeDispatcher();

    const runtime = new InfrastructureRuntime({
      database,
      cache,
      idempotencyStore,
      dispatcher
    });

    await runtime.initialize();
    await runtime.shutdown();
    await runtime.shutdown();

    assert.equal(runtime.isInitialized, false);

    assert.deepEqual(
      dispatcher.calls,
      ["start", "stop"]
    );

    assert.deepEqual(
      idempotencyStore.calls,
      ["initialize"]
    );

    assert.deepEqual(
      cache.calls,
      ["connect", "disconnect"]
    );

    assert.deepEqual(
      database.calls,
      ["connect", "disconnect"]
    );
  }
);