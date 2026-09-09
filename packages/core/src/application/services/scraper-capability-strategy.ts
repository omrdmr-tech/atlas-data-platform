import type { ScraperCapability } from "../ports/scraper-capabilities.js";
import type { SourceAccessStatus } from "../ports/source-access-detector.js";

export function capabilitiesForAccessStatus(
  status: SourceAccessStatus,
): readonly ScraperCapability[] {
  switch (status) {
    case "captcha":
    case "bot-blocked":
      return ["anti-bot", "browser", "proxy"];
    case "rate-limited":
      return ["proxy", "browser"];
    case "network-unavailable":
      return ["proxy"];
    case "server-error":
      return ["browser", "proxy"];
    case "login-required":
    case "subscription-required":
    case "paywall":
    case "partial-content":
      return ["browser", "javascript"];
    case "accessible":
      return [];
    case "unknown":
      return ["browser", "proxy"];
  }
}
