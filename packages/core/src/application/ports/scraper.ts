export interface ScrapeRequest {
  readonly url: string;
}

export interface ScrapeResult {
  readonly url: string;
  readonly statusCode: number;
  readonly content: string;
  readonly contentType: string | null;
}

export interface Scraper {
  readonly id: string;
  execute(request: ScrapeRequest): Promise<ScrapeResult>;
}
