import type { IdempotencyStore } from "../../ports/idempotency-store.js";

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Set<string>();

  public async has(key: string): Promise<boolean> {
    return this.keys.has(key);
  }

  public async mark(key: string): Promise<void> {
    this.keys.add(key);
  }

  public clear(): void {
    this.keys.clear();
  }
}
