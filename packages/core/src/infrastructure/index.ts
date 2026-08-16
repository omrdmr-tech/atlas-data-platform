export interface InfrastructureModule {
  readonly name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export * from "./ports/clock.js";
export * from "./ports/database.js";
export * from "./ports/transaction.js";
export * from "./ports/cache.js";
export * from "./ports/distributed-lock.js";
export * from "./ports/event-bus.js";
export * from "./ports/idempotency-store.js";
export * from "./adapters/system-clock.js";
export * from "./adapters/postgresql/postgresql-database.js";
export * from "./adapters/postgresql/postgresql-repository.js";
export * from "./adapters/postgresql/postgresql-transaction.js";
export * from "./adapters/postgresql/postgresql-idempotency-store.js";
export * from "./adapters/redis/redis-cache.js";
export * from "./adapters/redis/cache-repository.js";
export * from "./adapters/redis/redis-distributed-lock.js";
export * from "./adapters/event-bus/event-bus-error.js";
export * from "./adapters/event-bus/retry-policy.js";
export * from "./adapters/event-bus/idempotency.js";
export * from "./adapters/event-bus/in-memory-idempotency-store.js";
export * from "./adapters/event-bus/in-memory-event-bus.js";
