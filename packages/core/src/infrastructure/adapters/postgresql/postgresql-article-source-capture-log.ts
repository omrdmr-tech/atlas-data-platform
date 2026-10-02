import { randomUUID } from "node:crypto";
import type {
  ArticleSourceCaptureLog,
  ArticleSourceRecord,
} from "../../../application/ports/article-source-capture-log.js";
import type { Database } from "../../ports/database.js";

interface SourceRow {
  source_url: string;
  language: string | null;
  region: string | null;
  last_status: ArticleSourceRecord["lastStatus"];
  last_error: string | null;
  updated_at: Date | string;
}

export class PostgreSQLArticleSourceCaptureLog implements ArticleSourceCaptureLog {
  private initialization: Promise<void> | null = null;
  public constructor(private readonly database: Database) {}

  public async listSources(): Promise<readonly ArticleSourceRecord[]> {
    await this.ensureInitialized();
    const transaction = await this.database.createTransaction();
    try {
      await transaction.begin();
      const result = await transaction.query<SourceRow>(
        `SELECT source_url, language, region, last_status, last_error, updated_at
         FROM article_sources ORDER BY updated_at DESC`,
      );
      await transaction.commit();
      return result.rows.map((row) => ({
        sourceUrl: row.source_url,
        language: row.language,
        region: row.region,
        lastStatus: row.last_status,
        lastError: row.last_error,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      }));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async beginBatch(urls: readonly string[]): Promise<string> {
    await this.ensureInitialized();
    const batchId = randomUUID();
    const transaction = await this.database.createTransaction();
    try {
      await transaction.begin();
      for (const sourceUrl of urls) {
        await transaction.query(
          `INSERT INTO article_sources (source_url, last_status, last_error, updated_at)
           VALUES ($1, 'queued', NULL, NOW())
           ON CONFLICT (source_url) DO UPDATE SET
             last_status = 'queued', last_error = NULL, updated_at = NOW()`,
          [sourceUrl],
        );
        await transaction.query(
          `INSERT INTO article_capture_logs (batch_id, source_url, status, captured_at)
           VALUES ($1, $2, 'queued', NOW())`,
          [batchId, sourceUrl],
        );
      }
      await transaction.commit();
      return batchId;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async complete(batchId: string, sourceUrl: string, result: {
    status: "success" | "failed";
    details: string | null;
    language?: string | null;
    region?: string | null;
  }): Promise<void> {
    await this.ensureInitialized();
    const transaction = await this.database.createTransaction();
    try {
      await transaction.begin();
      await transaction.query(
        `UPDATE article_capture_logs SET status = $3, details = $4,
           language = $5, region = $6, captured_at = NOW()
         WHERE id = (SELECT id FROM article_capture_logs
           WHERE batch_id = $1 AND source_url = $2 AND status = 'queued'
           ORDER BY id DESC LIMIT 1)`,
        [batchId, sourceUrl, result.status, result.details, result.language ?? null, result.region ?? null],
      );
      await transaction.query(
        `UPDATE article_sources SET last_status = $2, last_error = $3,
           language = COALESCE($4, language), region = COALESCE($5, region), updated_at = NOW()
         WHERE source_url = $1`,
        [sourceUrl, result.status, result.status === "failed" ? result.details : null, result.language ?? null, result.region ?? null],
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.createTables().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }
    await this.initialization;
  }

  private async createTables(): Promise<void> {
    const transaction = await this.database.createTransaction();
    try {
      await transaction.begin();
      await transaction.query(`CREATE TABLE IF NOT EXISTS article_sources (
        source_url TEXT PRIMARY KEY, language TEXT, region TEXT,
        last_status TEXT NOT NULL, last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await transaction.query(`CREATE TABLE IF NOT EXISTS article_capture_logs (
        id BIGSERIAL PRIMARY KEY, batch_id UUID NOT NULL,
        source_url TEXT NOT NULL REFERENCES article_sources(source_url),
        status TEXT NOT NULL, details TEXT, language TEXT, region TEXT,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await transaction.query(`CREATE INDEX IF NOT EXISTS idx_article_capture_logs_batch
        ON article_capture_logs (batch_id, captured_at)`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
