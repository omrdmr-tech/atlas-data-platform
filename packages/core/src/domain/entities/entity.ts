import type { DomainEvent } from "../events/domain-event.js";

export abstract class Entity<TId> {
  private readonly domainEvents: DomainEvent[] = [];

  public constructor(public readonly id: TId) {}

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public getDomainEvents(): readonly DomainEvent[] {
    return [...this.domainEvents];
  }

  public clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }
}

