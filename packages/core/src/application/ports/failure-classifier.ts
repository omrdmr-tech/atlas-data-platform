import type {
  ScraperFailure,
  ScraperFailureReason,
} from "./scraper-orchestrator.js";

import type {
  SourceAccessDetection,
  SourceAccessStatus,
} from "./source-access-detector.js";

export type FailureRecoveryHint =
  | "retry"
  | "browser"
  | "proxy"
  | "alternate-access"
  | "wait"
  | "stop"
  | "unknown";

export interface FailureClassification {
  readonly technicalFailure: ScraperFailureReason | null;
  readonly accessCondition: SourceAccessStatus;
  readonly recoveryHint: FailureRecoveryHint;
}

export interface FailureClassifier {
  classify(
    failure: ScraperFailure,
    detection?: SourceAccessDetection
  ): FailureClassification;
}