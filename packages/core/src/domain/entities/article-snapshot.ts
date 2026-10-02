import { Entity } from "./entity.js";

export interface ArticleSnapshotProperties {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly html: string;
  readonly contentType: string | null;
  readonly fetchedAt: string;
  readonly scraperId: string;
  readonly language?: string | null;
  readonly region?: string | null;
}

export class ArticleSnapshot extends Entity<string> {
  public readonly sourceUrl: string;
  public readonly finalUrl: string;
  public readonly html: string;
  public readonly contentType: string | null;
  public readonly fetchedAt: string;
  public readonly scraperId: string;
  public readonly language: string | null;
  public readonly region: string | null;

  public constructor(properties: ArticleSnapshotProperties) {
    const sourceUrl = normalizeHttpUrl(properties.sourceUrl);
    super(sourceUrl);

    this.sourceUrl = sourceUrl;
    this.finalUrl = normalizeHttpUrl(properties.finalUrl);
    this.html = properties.html;
    this.contentType = properties.contentType;
    this.fetchedAt = normalizeDate(properties.fetchedAt);
    this.scraperId = requireText(properties.scraperId, "scraperId");
    this.language = normalizeOptionalText(properties.language);
    this.region = normalizeOptionalText(properties.region);
  }
}

function normalizeHttpUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Article URLs must be valid absolute URLs.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error("Article URLs must use HTTP or HTTPS without credentials.");
  }

  url.hash = "";
  return url.toString();
}

function normalizeDate(value: string): string {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error("fetchedAt must be a valid date.");
  }

  return new Date(timestamp).toISOString();
}

function requireText(value: string, name: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${name} must not be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
