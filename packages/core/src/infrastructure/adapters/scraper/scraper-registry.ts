import type {
  ScraperCapability,
} from "../../../application/ports/scraper-capabilities.js";
import type {
  Scraper,
} from "../../../application/ports/scraper.js";
import type {
  ScraperRegistry as ScraperRegistryPort,
} from "../../../application/ports/scraper-registry.js";

export class ScraperRegistry
  implements ScraperRegistryPort
{
  private readonly scrapers: Scraper[] = [];

  public register(scraper: Scraper): void {
    if (
      this.scrapers.some(
        (existing) =>
          existing.descriptor.scraperId ===
          scraper.descriptor.scraperId
      )
    ) {
      throw new Error(
        `Scraper "${scraper.descriptor.scraperId}" is already registered.`
      );
    }

    this.scrapers.push(scraper);
  }

  public getAll(): readonly Scraper[] {
    return [...this.scrapers];
  }

  public findByCapabilities(
    requiredCapabilities: readonly ScraperCapability[]
  ): readonly Scraper[] {
    return this.scrapers.filter((scraper) =>
      requiredCapabilities.every((requiredCapability) =>
        scraper.descriptor.capabilities.includes(
          requiredCapability
        )
      )
    );
  }

  public findById(
    scraperId: string
  ): Scraper | null {
    return (
      this.scrapers.find(
        (scraper) =>
          scraper.descriptor.scraperId === scraperId
      ) ?? null
    );
  }
}
