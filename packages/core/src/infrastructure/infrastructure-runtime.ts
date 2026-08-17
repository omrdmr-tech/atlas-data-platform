import type { Database } from "./ports/database.js";

export interface InfrastructureRuntimeOptions {
  readonly database: Database;

  readonly cache: {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  };

  readonly idempotencyStore: {
    initialize(): Promise<void>;
  };

  readonly dispatcher: {
    start(): void;
    stop(): Promise<void>;
  };
}

export class InfrastructureRuntime {
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
      await this.options.cache.connect();
      await this.options.idempotencyStore.initialize();

      this.options.dispatcher.start();

      this.initialized = true;
    } catch (error) {
      await this.options.cache.disconnect();
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

    await this.options.dispatcher.stop();
    await this.options.cache.disconnect();
    await this.options.database.disconnect();
  }
}