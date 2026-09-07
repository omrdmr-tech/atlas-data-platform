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
export * from "./application/outbox-dispatcher.js";
export * from "./ports/outbox-publisher.js";
export * from "./adapters/event-bus/outbox-event-publisher.js";
export * from "./infrastructure-runtime.js";
export * from "./adapters/scraper/http-scraper.js";
export * from "./adapters/scraper/default-scraper-selection-policy.js";
export * from "./adapters/scraper/browser-scraper.js";

export * from "./adapters/scraper/in-memory-proxy-provider.js";
export * from "./adapters/scraper/proxy-scraper.js";

export * from "./adapters/scraper/content-access-detector.js";
export * from "./adapters/logging/in-memory-process-log.js";
export * from "./adapters/logging/in-memory-source-access-log.js";
export * from "./adapters/logging/system-request-id-generator.js";
export {
  InMemorySourceHealthStore,
} from "./adapters/scraper/in-memory-source-health-store.js";
export * from "./adapters/logging/health-aware-source-access-log.js";
export * from "./adapters/scraper/adaptive-scraper-selection-policy.js";
