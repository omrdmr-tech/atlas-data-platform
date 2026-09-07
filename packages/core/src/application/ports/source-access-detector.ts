import type { ScrapeResult } from "./scraper.js";

export type SourceAccessStatus =
  | "accessible"
  | "login-required"
  | "subscription-required"
  | "paywall"
  | "captcha"
  | "bot-blocked"
  | "rate-limited"
  | "network-unavailable"
  | "server-error"
  | "partial-content"
  | "unknown";

export type SourceAccessType =
  | "http"
  | "browser"
  | "proxy"
  | "unknown";

export interface SourceAccessDetection {
  readonly status: SourceAccessStatus;
  readonly accessType: SourceAccessType;
  readonly requiresLogin: boolean;
  readonly requiresSubscription: boolean;
  readonly paywallDetected: boolean;
  readonly captchaDetected: boolean;
  readonly contentAvailable: boolean;
}

export interface SourceAccessDetector {
  detect(
    result: ScrapeResult,
    accessType?: SourceAccessType
  ): SourceAccessDetection;
}
