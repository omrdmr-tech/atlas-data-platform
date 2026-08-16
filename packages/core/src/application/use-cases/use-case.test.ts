import { test } from "node:test";
import assert from "node:assert/strict";
import type { UseCase } from "./use-case.js";

class EchoUseCase implements UseCase<string, string> {
  public async execute(request: string): Promise<string> {
    return request;
  }
}

test("UseCase executes an application operation", async () => {
  const useCase = new EchoUseCase();

  assert.equal(await useCase.execute("Atlas"), "Atlas");
});
