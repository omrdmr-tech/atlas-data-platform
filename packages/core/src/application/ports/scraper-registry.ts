import type { ScraperCapability } from "./scraper-capabilities.js";
import type { Scraper } from "./scraper.js";

export interface ScraperRegistry {
  register(scraper: Scraper): void;

  getAll(): readonly Scraper[];

  findByCapabilities(
    requiredCapabilities: readonly ScraperCapability[]
  ): readonly Scraper[];

  findById(scraperId: string): Scraper | null;
}
