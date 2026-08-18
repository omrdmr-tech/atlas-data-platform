export type ScraperCapability =
  | "http"
  | "browser"
  | "javascript"
  | "proxy"
  | "anti-bot";

export interface ScraperDescriptor {
  readonly scraperId: string;
  readonly capabilities: readonly ScraperCapability[];
}
