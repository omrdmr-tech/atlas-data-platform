import { test } from "node:test";
import assert from "node:assert/strict";
import { Entity } from "./entity.js";
import type { DomainEvent } from "../events/domain-event.js";

class TestEntity extends Entity<string> {
  public addEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}

const createEvent = (type: string): DomainEvent => ({
  type,
  occurredAt: new Date()
});

test("Entity preserves its identifier", () => {
  const entity = new TestEntity("test-id");

  assert.equal(entity.id, "test-id");
});

test("Entity collects domain events", () => {
  const entity = new TestEntity("test-id");
  const event = createEvent("test.event");

  entity.addEvent(event);

  assert.deepEqual(entity.getDomainEvents(), [event]);
});

test("Entity returns a copy of its domain events", () => {
  const entity = new TestEntity("test-id");
  const event = createEvent("test.event");

  entity.addEvent(event);

  const events = entity.getDomainEvents();

  assert.notEqual(events, entity.getDomainEvents());
  assert.equal(events.length, 1);
  assert.deepEqual(events, [event]);
});

test("Entity clears domain events", () => {
  const entity = new TestEntity("test-id");
  const event = createEvent("test.event");

  entity.addEvent(event);
  entity.clearDomainEvents();

  assert.deepEqual(entity.getDomainEvents(), []);
});