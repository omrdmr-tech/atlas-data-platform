import { test } from "node:test";
import assert from "node:assert/strict";
import type { InfrastructureModule } from "./index.js";

class TestInfrastructure implements InfrastructureModule {
  public readonly name = "test-infrastructure";
  private initialized = false;

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public async shutdown(): Promise<void> {
    this.initialized = false;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

test("InfrastructureModule supports initialization and shutdown", async () => {
  const infrastructure = new TestInfrastructure();

  assert.equal(infrastructure.isInitialized(), false);

  await infrastructure.initialize();
  assert.equal(infrastructure.isInitialized(), true);

  await infrastructure.shutdown();
  assert.equal(infrastructure.isInitialized(), false);
});
