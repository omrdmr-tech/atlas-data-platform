import { test } from "node:test";
import assert from "node:assert/strict";
import { ValueObject } from "./value-object.js";

class TestValue extends ValueObject<{ name: string }> {}

test("ValueObject considers equal values equal", () => {
  const first = new TestValue({ name: "Atlas" });
  const second = new TestValue({ name: "Atlas" });
  assert.equal(first.equals(second), true);
});

test("ValueObject detects different values", () => {
  const first = new TestValue({ name: "Atlas" });
  const second = new TestValue({ name: "Other" });
  assert.equal(first.equals(second), false);
});
