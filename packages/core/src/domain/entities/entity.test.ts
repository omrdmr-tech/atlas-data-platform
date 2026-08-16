import { test } from "node:test";
import assert from "node:assert/strict";
import { Entity } from "./entity.js";

class TestEntity extends Entity<string> {}

test("Entity preserves its identifier", () => {
  const entity = new TestEntity("test-id");
  assert.equal(entity.id, "test-id");
});
