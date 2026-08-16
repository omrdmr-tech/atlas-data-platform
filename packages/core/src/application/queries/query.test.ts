import { test } from "node:test";
import assert from "node:assert/strict";
import type { Query } from "./query.js";
import type { QueryHandler } from "./query-handler.js";

class TestQuery implements Query<string> {
  public readonly type = "TestQuery";
}

class TestHandler implements QueryHandler<TestQuery, string> {
  public async execute(query: TestQuery): Promise<string> {
    return query.type;
  }
}

test("Query handler returns query data", async () => {
  const handler = new TestHandler();
  assert.equal(await handler.execute(new TestQuery()), "TestQuery");
});
