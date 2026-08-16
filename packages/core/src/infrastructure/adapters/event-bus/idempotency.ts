import type { DomainEvent } from "../../../domain/events/domain-event.js";

export type EventIdentityResolver = (event: DomainEvent) => string;

export const defaultEventIdentity: EventIdentityResolver = (event) => {
  const candidate = event as DomainEvent & {
    readonly eventId?: unknown;
    readonly id?: unknown;
  };

  if (typeof candidate.eventId === "string" && candidate.eventId.length > 0) {
    return candidate.eventId;
  }

  if (typeof candidate.id === "string" && candidate.id.length > 0) {
    return candidate.id;
  }

  return `${event.type}:${event.occurredAt.getTime()}`;
};
