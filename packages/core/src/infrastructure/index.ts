export interface InfrastructureModule {
  readonly name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export * from "./ports/clock.js";
export * from "./ports/database.js";
export * from "./ports/transaction.js";
export * from "./adapters/system-clock.js";
export * from "./adapters/postgresql/postgresql-database.js";
export * from "./adapters/postgresql/postgresql-repository.js";
export * from "./adapters/postgresql/postgresql-transaction.js";
