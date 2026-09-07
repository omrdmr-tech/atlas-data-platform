import type {
  ScrapeResult,
} from "../../../application/ports/scraper.js";

import type {
  SourceAccessDetector as SourceAccessDetectorPort,
  SourceAccessDetection,
  SourceAccessStatus,
  SourceAccessType,
} from "../../../application/ports/source-access-detector.js";

export class ContentAccessDetector
  implements SourceAccessDetectorPort
{
  public detect(
    result: ScrapeResult,
    accessType: SourceAccessType = "unknown"
  ): SourceAccessDetection {
    const statusFromHttp = classifyHttpStatus(
      result.statusCode
    );

    if (statusFromHttp !== null) {
      return {
        status: statusFromHttp,
        accessType,
        requiresLogin: statusFromHttp === "login-required",
        requiresSubscription:
          statusFromHttp === "subscription-required",
        paywallDetected:
          statusFromHttp === "paywall",
        captchaDetected:
          statusFromHttp === "captcha",
        contentAvailable: false,
      };
    }

    const content = normalize(result.content);

    const captchaDetected =
      containsAny(content, [
        "captcha",
        "recaptcha",
        "hcaptcha",
        "verify you are human",
        "i'm not a robot",
        "im not a robot",
      ]);

    if (captchaDetected) {
      return inaccessible(
        "captcha",
        accessType,
        {
          captchaDetected: true,
        }
      );
    }

    const botBlocked = containsAny(content, [
      "bot detected",
      "automated requests",
      "automated traffic",
      "unusual traffic",
      "access denied",
      "checking your browser",
      "cf-chl-",
      "challenge-platform",
      "enable javascript and cookies",
    ]);

    if (botBlocked) {
      return inaccessible(
        "bot-blocked",
        accessType
      );
    }

    const subscriptionRequired = containsAny(content, [
      "subscription required",
      "subscribers only",
      "subscriber only",
      "become a subscriber",
      "membership required",
      "this article is for subscribers",
    ]);

    if (subscriptionRequired) {
      return inaccessible(
        "subscription-required",
        accessType,
        {
          requiresSubscription: true,
          paywallDetected: true,
        }
      );
    }

    const loginRequired = containsAny(content, [
      "login required",
      "log in to continue",
      "login to continue",
      "please log in",
      "please login",
      "sign in to continue",
      "sign in required",
      "member login",
      "authentication required",
    ]);

    if (loginRequired) {
      return inaccessible(
        "login-required",
        accessType,
        {
          requiresLogin: true,
        }
      );
    }

    const paywallDetected = containsAny(content, [
      "paywall",
      "continue reading",
      "unlock this article",
      "unlock the full article",
      "you've reached your limit",
      "you have reached your limit",
      "free articles remaining",
    ]);

    if (paywallDetected) {
      return inaccessible(
        "paywall",
        accessType,
        {
          paywallDetected: true,
        }
      );
    }

    const partialContent = containsAny(content, [
      "content continues below",
      "article continues",
      "continue below",
    ]);

    if (partialContent) {
      return inaccessible(
        "partial-content",
        accessType
      );
    }

    return {
      status: "accessible",
      accessType,
      requiresLogin: false,
      requiresSubscription: false,
      paywallDetected: false,
      captchaDetected: false,
      contentAvailable: true,
    };
  }
}

function inaccessible(
  status: SourceAccessStatus,
  accessType: SourceAccessType,
  flags: Partial<SourceAccessDetection> = {}
): SourceAccessDetection {
  return {
    status,
    accessType,
    requiresLogin: false,
    requiresSubscription: false,
    paywallDetected: false,
    captchaDetected: false,
    contentAvailable: false,
    ...flags,
  };
}

function classifyHttpStatus(
  statusCode: number
): SourceAccessStatus | null {
  if (statusCode === 401) {
    return "login-required";
  }

  if (statusCode === 403) {
    return "bot-blocked";
  }

  if (statusCode === 429) {
    return "rate-limited";
  }

  if (statusCode === 408 || statusCode === 504) {
    return "network-unavailable";
  }

  if (statusCode >= 500 && statusCode <= 599) {
    return "server-error";
  }

  return null;
}

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(
  content: string,
  values: readonly string[]
): boolean {
  return values.some((value) => content.includes(value));
}
