import { test } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "./domain-event.js";

class TestEvent extends BaseDomainEvent {
  public constructor() {
    super("TestEvent");
  }
}

test("BaseDomainEvent sets its type and occurrence time", () => {
  const event = new TestEvent();
  assert.equal(event.type, "TestEvent");
  assert.ok(event.occurredAt instanceof Date);
});
