export interface InfrastructureModule {
  readonly name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export * from "./ports/clock.js";
export * from "./adapters/system-clock.js";
