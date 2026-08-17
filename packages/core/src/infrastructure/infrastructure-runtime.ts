import type { Database } from "./ports/database.js";

export interface InfrastructureLifecycle {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface InfrastructureRuntimeOptions {
  readonly database: Database;
  readonly cache: InfrastructureLifecycle;
  readonly idempotencyStore: InfrastructureLifecycle;
  readonly dispatcher: InfrastructureLifecycle;
}

export class InfrastructureRuntime
  implements InfrastructureLifecycle
{
  private initialized = false;
  private shuttingDown: Promise<void> | null = null;

  public constructor(
    private readonly options: InfrastructureRuntimeOptions
  ) {}

  public get isInitialized(): boolean {
    return this.initialized;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.options.database.connect();

    try {
      await this.options.cache.initialize();
      await this.options.idempotencyStore.initialize();
      await this.options.dispatcher.initialize();

      this.initialized = true;
    } catch (error) {
      await this.options.database.disconnect();
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (
      !this.initialized &&
      this.shuttingDown === null
    ) {
      return;
    }

    if (this.shuttingDown !== null) {
      return this.shuttingDown;
    }

    this.shuttingDown = this.performShutdown();

    try {
      await this.shuttingDown;
    } finally {
      this.shuttingDown = null;
    }
  }

  private async performShutdown(): Promise<void> {
    this.initialized = false;

    await this.options.dispatcher.shutdown();
    await this.options.idempotencyStore.shutdown();
    await this.options.cache.shutdown();
    await this.options.database.disconnect();
  }
}