import { test } from "node:test";
import assert from "node:assert/strict";
import { Entity } from "../entities/entity.js";
import type { Repository } from "./repository.js";

class TestEntity extends Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}

class InMemoryRepository implements Repository<TestEntity, string> {
  private readonly items = new Map<string, TestEntity>();

  public async findById(id: string): Promise<TestEntity | null> {
    return this.items.get(id) ?? null;
  }

  public async save(entity: TestEntity): Promise<void> {
    this.items.set(entity.id, entity);
  }
}

test("Repository saves and retrieves an entity", async () => {
  const repository = new InMemoryRepository();
  const entity = new TestEntity("1", "Atlas");

  await repository.save(entity);

  assert.deepEqual(await repository.findById("1"), entity);
});

test("Repository returns null for an unknown identifier", async () => {
  const repository = new InMemoryRepository();

  assert.equal(await repository.findById("missing"), null);
});
