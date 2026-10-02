export type ArticleSourceCaptureStatus = "queued" | "success" | "failed";

export interface ArticleSourceRecord {
  readonly sourceUrl: string;
  readonly language: string | null;
  readonly region: string | null;
  readonly lastStatus: ArticleSourceCaptureStatus;
  readonly lastError: string | null;
  readonly updatedAt: string;
}

export interface ArticleCaptureLogEntry {
  readonly batchId: string;
  readonly sourceUrl: string;
  readonly status: ArticleSourceCaptureStatus;
  readonly details: string | null;
  readonly capturedAt: string;
}

export interface ArticleSourceCaptureLog {
  listSources(): Promise<readonly ArticleSourceRecord[]>;
  beginBatch(urls: readonly string[]): Promise<string>;
  complete(batchId: string, sourceUrl: string, result: {
    status: Exclude<ArticleSourceCaptureStatus, "queued">;
    details: string | null;
    language?: string | null;
    region?: string | null;
  }): Promise<void>;
}
