export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredAt: Date;

  protected constructor(public readonly type: string, occurredAt?: Date) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
