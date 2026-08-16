import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApplicationService } from "./application-service.js";

class TestService implements ApplicationService<string, string> {
  public async execute(request: string): Promise<string> {
    return `processed:${request}`;
  }
}

test("ApplicationService orchestrates an application operation", async () => {
  const service = new TestService();

  assert.equal(await service.execute("Atlas"), "processed:Atlas");
});
