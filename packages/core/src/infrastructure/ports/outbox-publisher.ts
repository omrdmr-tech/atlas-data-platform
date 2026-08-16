import type { OutboxEvent } from "./outbox.js";

export interface OutboxPublisher {
  publish(event: OutboxEvent): Promise<void>;
}
