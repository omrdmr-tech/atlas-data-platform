import assert from "node:assert/strict";
import test from "node:test";

import type {
  ScraperFailure,
} from "../../../application/ports/scraper-orchestrator.js";

import type {
  SourceAccessDetection,
} from "../../../application/ports/source-access-detector.js";

import {
  DefaultFailureClassifier,
} from "./failure-classifier.js";

const classifier = new DefaultFailureClassifier();

function failure(
  reason: ScraperFailure["reason"],
  statusCode: number | null = null
): ScraperFailure {
  return {
    scraperId: "test-scraper",
    reason,
    statusCode,
    error: new Error("test failure"),
  };
}

function detection(
  status: SourceAccessDetection["status"]
): SourceAccessDetection {
  return {
    status,
    accessType: "http",
    requiresLogin: status === "login-required",
    requiresSubscription:
      status === "subscription-required",
    paywallDetected: status === "paywall",
    captchaDetected: status === "captcha",
    contentAvailable: status === "accessible",
  };
}

test("classifies blocked failure and recommends browser", () => {
  const result = classifier.classify(
    failure("blocked", 403)
  );

  assert.equal(result.technicalFailure, "blocked");
  assert.equal(result.accessCondition, "bot-blocked");
  assert.equal(result.recoveryHint, "browser");
});

test("classifies rate-limited failure and recommends waiting", () => {
  const result = classifier.classify(
    failure("rate-limited", 429)
  );

  assert.equal(result.technicalFailure, "rate-limited");
  assert.equal(result.accessCondition, "rate-limited");
  assert.equal(result.recoveryHint, "wait");
});

test("classifies server failure and recommends retry", () => {
  const result = classifier.classify(
    failure("server-error", 503)
  );

  assert.equal(result.accessCondition, "server-error");
  assert.equal(result.recoveryHint, "retry");
});

test("classifies network failure and recommends alternate access", () => {
  const result = classifier.classify(
    failure("network-error")
  );

  assert.equal(
    result.accessCondition,
    "network-unavailable"
  );
  assert.equal(result.recoveryHint, "alternate-access");
});

test("uses detected access condition for recovery guidance", () => {
  const result = classifier.classify(
    failure("blocked", 403),
    detection("captcha")
  );

  assert.equal(result.technicalFailure, "blocked");
  assert.equal(result.accessCondition, "captcha");
  assert.equal(result.recoveryHint, "browser");
});

test("stops recovery for subscription-required access", () => {
  const result = classifier.classify(
    failure("blocked"),
    detection("subscription-required")
  );

  assert.equal(
    result.accessCondition,
    "subscription-required"
  );
  assert.equal(result.recoveryHint, "stop");
});
