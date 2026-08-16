export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs: number;
}

export function validateRetryPolicy(policy: RetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new Error("Retry maxAttempts must be a positive integer.");
  }

  if (!Number.isInteger(policy.delayMs) || policy.delayMs < 0) {
    throw new Error("Retry delayMs must be a non-negative integer.");
  }
}
