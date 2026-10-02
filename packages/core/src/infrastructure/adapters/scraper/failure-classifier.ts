import type {
  FailureClassifier,
  FailureClassification,
  FailureRecoveryHint,
} from "../../../application/ports/failure-classifier.js";

import type {
  ScraperFailure,
  ScraperFailureReason,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  SourceAccessDetection,
  SourceAccessStatus,
} from "../../../application/ports/source-access-detector.js";

export class DefaultFailureClassifier
  implements FailureClassifier
{
  public classify(
    failure: ScraperFailure,
    detection?: SourceAccessDetection
  ): FailureClassification {
    if (detection) {
      return {
        technicalFailure: failure.reason,
        accessCondition: detection.status,
        recoveryHint: recoveryHintForAccessStatus(
          detection.status
        ),
      };
    }

    return {
      technicalFailure: failure.reason,
      accessCondition:
        accessStatusForFailure(failure.reason),
      recoveryHint:
        recoveryHintForFailure(failure.reason),
    };
  }
}

function accessStatusForFailure(
  reason: ScraperFailureReason
): SourceAccessStatus {
  switch (reason) {
    case "blocked":
      return "bot-blocked";

    case "rate-limited":
      return "rate-limited";

    case "server-error":
      return "server-error";

    case "timeout":
    case "network-error":
      return "network-unavailable";

    case "http-error":
    case "unknown":
    default:
      return "unknown";
  }
}

function recoveryHintForFailure(
  reason: ScraperFailureReason
): FailureRecoveryHint {
  switch (reason) {
    case "blocked":
      return "browser";

    case "rate-limited":
      return "wait";

    case "server-error":
      return "retry";

    case "timeout":
    case "network-error":
      return "alternate-access";

    case "http-error":
      return "alternate-access";

    case "unknown":
    default:
      return "unknown";
  }
}

function recoveryHintForAccessStatus(
  status: SourceAccessStatus
): FailureRecoveryHint {
  switch (status) {
    case "captcha":
    case "bot-blocked":
      return "browser";

    case "rate-limited":
      return "wait";

    case "network-unavailable":
      return "alternate-access";

    case "server-error":
      return "retry";

    case "login-required":
    case "subscription-required":
    case "paywall":
      return "stop";

    case "partial-content":
      return "alternate-access";

    case "accessible":
      return "retry";

    case "unknown":
    default:
      return "unknown";
  }
}
