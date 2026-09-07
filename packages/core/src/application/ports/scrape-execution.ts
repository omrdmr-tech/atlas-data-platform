import type {
  ScrapeRequest,
  ScrapeResult,
} from "./scraper.js";

export interface RequestIdGenerator {
  generate(): string;
}

export function resolveRequestId(
  request: ScrapeRequest,
  generator: RequestIdGenerator
): string {
  return request.requestId ?? generator.generate();
}

export function resolveSourceId(
  request: ScrapeRequest
): string {
  if (request.sourceId) {
    return request.sourceId;
  }

  return new URL(request.url).hostname.toLowerCase();
}

export function isSuccessfulHttpResponse(
  result: ScrapeResult
): boolean {
  return result.statusCode >= 200 &&
    result.statusCode < 300;
}
