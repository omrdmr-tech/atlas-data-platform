export interface EventHandlerFailure {
  readonly eventType: string;
  readonly error: unknown;
}

export class EventBusPublishError extends Error {
  public constructor(
    public readonly failures: readonly EventHandlerFailure[]
  ) {
    super(
      `Event bus publish failed for ${failures.length} handler(s).`
    );
    this.name = "EventBusPublishError";
  }
}
