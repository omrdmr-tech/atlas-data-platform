export interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  mark(key: string): Promise<void>;
}
