import type {
  ScraperCapability,
  ScraperDescriptor,
} from "./scraper-capabilities.js";

export interface ScrapeRequest {
  readonly url: string;
  readonly requiredCapabilities?: readonly ScraperCapability[];
}

export interface ScrapeResult {
  readonly url: string;
  readonly statusCode: number;
  readonly content: string;
  readonly contentType: string | null;
}

export interface Scraper {
  readonly id: string;
  readonly descriptor: ScraperDescriptor;
  execute(request: ScrapeRequest): Promise<ScrapeResult>;
}