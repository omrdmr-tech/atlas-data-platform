import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentAccessDetector,
} from "./content-access-detector.js";

const detector = new ContentAccessDetector();

function result(content: string, statusCode = 200) {
  return {
    url: "https://example.com/article",
    statusCode,
    content,
    contentType: "text/html",
  };
}

test("detects accessible content", () => {
  const detection = detector.detect(
    result("<article>Real news article content.</article>"),
    "http"
  );

  assert.equal(detection.status, "accessible");
  assert.equal(detection.contentAvailable, true);
  assert.equal(detection.accessType, "http");
});

test("detects login-required content", () => {
  const detection = detector.detect(
    result("<html>Please log in to continue.</html>"),
    "http"
  );

  assert.equal(detection.status, "login-required");
  assert.equal(detection.requiresLogin, true);
  assert.equal(detection.contentAvailable, false);
});

test("detects subscription-required content", () => {
  const detection = detector.detect(
    result(
      "<html>This article is for subscribers. Subscription required.</html>"
    ),
    "browser"
  );

  assert.equal(
    detection.status,
    "subscription-required"
  );
  assert.equal(
    detection.requiresSubscription,
    true
  );
  assert.equal(detection.paywallDetected, true);
});

test("detects paywall content", () => {
  const detection = detector.detect(
    result(
      "<html>You have reached your limit. Continue reading by subscribing.</html>"
    ),
    "http"
  );

  assert.equal(detection.status, "paywall");
  assert.equal(detection.paywallDetected, true);
  assert.equal(detection.contentAvailable, false);
});

test("detects CAPTCHA", () => {
  const detection = detector.detect(
    result("<html>Verify you are human. CAPTCHA required.</html>"),
    "browser"
  );

  assert.equal(detection.status, "captcha");
  assert.equal(detection.captchaDetected, true);
});

test("detects bot protection", () => {
  const detection = detector.detect(
    result("<html>Checking your browser before accessing this site.</html>"),
    "http"
  );

  assert.equal(detection.status, "bot-blocked");
  assert.equal(detection.contentAvailable, false);
});

test("detects HTTP login-required", () => {
  const detection = detector.detect(
    result("", 401),
    "http"
  );

  assert.equal(detection.status, "login-required");
});

test("detects HTTP rate limiting", () => {
  const detection = detector.detect(
    result("", 429),
    "proxy"
  );

  assert.equal(detection.status, "rate-limited");
});

test("detects server failure", () => {
  const detection = detector.detect(
    result("", 503),
    "browser"
  );

  assert.equal(detection.status, "server-error");
});
