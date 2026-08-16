export interface DistributedLock {
  acquire(key: string, ttlSeconds: number): Promise<boolean>;
  release(key: string): Promise<boolean>;
}
