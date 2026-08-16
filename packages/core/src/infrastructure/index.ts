export interface InfrastructureModule {
  readonly name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}
