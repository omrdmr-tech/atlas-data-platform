import type {
  SourceHealthAccessRecord,
  SourceScraperHealth,
  SourceHealthSnapshot,
  SourceHealthStore,
} from "../../../application/ports/source-health.js";
import type { Database } from "../../ports/database.js";
import type { Transaction } from "../../ports/transaction.js";

interface SourceHealthRow {
  source_id: string;
  domain: string;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  login_required_count: number;
  subscription_required_count: number;
  paywall_count: number;
  captcha_count: number;
  bot_blocked_count: number;
  rate_limited_count: number;
  network_unavailable_count: number;
  server_error_count: number;
  partial_content_count: number;
  last_access_status: string | null;
  last_access_type: string | null;
  last_scraper_id: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}

interface SourceHealthScraperRow {
  scraper_id: string;
  access_type: string;
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  last_access_status: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
}

export class PostgreSQLSourceHealthStore implements SourceHealthStore {
  public constructor(
    private readonly database: Database,
  ) {}

  public async initialize(): Promise<void> {
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();

      await transaction.query(`
        CREATE TABLE IF NOT EXISTS source_health (
          source_id TEXT PRIMARY KEY,
          domain TEXT NOT NULL,
          total_attempts INTEGER NOT NULL DEFAULT 0,
          successful_attempts INTEGER NOT NULL DEFAULT 0,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          login_required_count INTEGER NOT NULL DEFAULT 0,
          subscription_required_count INTEGER NOT NULL DEFAULT 0,
          paywall_count INTEGER NOT NULL DEFAULT 0,
          captcha_count INTEGER NOT NULL DEFAULT 0,
          bot_blocked_count INTEGER NOT NULL DEFAULT 0,
          rate_limited_count INTEGER NOT NULL DEFAULT 0,
          network_unavailable_count INTEGER NOT NULL DEFAULT 0,
          server_error_count INTEGER NOT NULL DEFAULT 0,
          partial_content_count INTEGER NOT NULL DEFAULT 0,
          last_access_status TEXT,
          last_access_type TEXT,
          last_scraper_id TEXT,
          last_attempt_at TIMESTAMPTZ,
          last_success_at TIMESTAMPTZ,
          last_failure_at TIMESTAMPTZ
        )
      `);

      await transaction.query(`
        CREATE TABLE IF NOT EXISTS source_health_scrapers (
          source_id TEXT NOT NULL,
          scraper_id TEXT NOT NULL,
          access_type TEXT NOT NULL,
          total_attempts INTEGER NOT NULL DEFAULT 0,
          successful_attempts INTEGER NOT NULL DEFAULT 0,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          last_access_status TEXT,
          last_attempt_at TIMESTAMPTZ,
          last_success_at TIMESTAMPTZ,
          last_failure_at TIMESTAMPTZ,
          PRIMARY KEY (source_id, scraper_id),
          FOREIGN KEY (source_id)
            REFERENCES source_health(source_id)
            ON DELETE CASCADE
        )
      `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async recordAccess(
    input: SourceHealthAccessRecord,
  ): Promise<void> {
    const sourceId = input.sourceId.trim();
    const domain = this.normalizeDomain(input.domain);

    if (!sourceId) {
      throw new Error("Source ID is required.");
    }

    if (!domain) {
      throw new Error("Source domain is required.");
    }

    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();

      const success = input.success;
      const statusColumn = this.statusColumn(input.status);

      const statusInsertColumn = statusColumn
        ? `,
            ${statusColumn}`
        : "";

      const statusInsertValue = statusColumn
        ? ", 1"
        : "";

      const statusUpdate = statusColumn
        ? `,
            ${statusColumn} =
              source_health.${statusColumn} + 1`
        : "";

      await transaction.query(
        `
          INSERT INTO source_health (
            source_id,
            domain,
            total_attempts,
            successful_attempts,
            failed_attempts${statusInsertColumn},
            last_access_status,
            last_access_type,
            last_scraper_id,
            last_attempt_at,
            last_success_at,
            last_failure_at
          )
          VALUES (
            $1, $2, 1, $3, $4${statusInsertValue},
            $5, $6, $7, $8,
            CASE WHEN $9 THEN $8 ELSE NULL END,
            CASE WHEN NOT $9 THEN $8 ELSE NULL END
          )
          ON CONFLICT (source_id)
          DO UPDATE SET
            domain = EXCLUDED.domain,
            total_attempts = source_health.total_attempts + 1,
            successful_attempts =
              source_health.successful_attempts + EXCLUDED.successful_attempts,
            failed_attempts =
              source_health.failed_attempts + EXCLUDED.failed_attempts${statusUpdate},
            last_access_status = EXCLUDED.last_access_status,
            last_access_type = EXCLUDED.last_access_type,
            last_scraper_id = EXCLUDED.last_scraper_id,
            last_attempt_at = EXCLUDED.last_attempt_at,
            last_success_at =
              CASE
                WHEN EXCLUDED.last_success_at IS NOT NULL
                THEN EXCLUDED.last_success_at
                ELSE source_health.last_success_at
              END,
            last_failure_at =
              CASE
                WHEN EXCLUDED.last_failure_at IS NOT NULL
                THEN EXCLUDED.last_failure_at
                ELSE source_health.last_failure_at
              END
        `,
        [
          sourceId,
          domain,
          success ? 1 : 0,
          success ? 0 : 1,
          input.status,
          input.accessType,
          input.scraperId,
          input.occurredAt,
          success,
        ],
      );

      await transaction.query(
        `
          INSERT INTO source_health_scrapers (
            source_id,
            scraper_id,
            access_type,
            total_attempts,
            successful_attempts,
            failed_attempts,
            last_access_status,
            last_attempt_at,
            last_success_at,
            last_failure_at
          )
          VALUES (
            $1, $2, $3, 1, $4, $5, $6, $7,
            CASE WHEN $8 THEN $7 ELSE NULL END,
            CASE WHEN NOT $8 THEN $7 ELSE NULL END
          )
          ON CONFLICT (source_id, scraper_id)
          DO UPDATE SET
            access_type = EXCLUDED.access_type,
            total_attempts =
              source_health_scrapers.total_attempts + 1,
            successful_attempts =
              source_health_scrapers.successful_attempts +
              EXCLUDED.successful_attempts,
            failed_attempts =
              source_health_scrapers.failed_attempts +
              EXCLUDED.failed_attempts,
            last_access_status = EXCLUDED.last_access_status,
            last_attempt_at = EXCLUDED.last_attempt_at,
            last_success_at =
              CASE
                WHEN EXCLUDED.last_success_at IS NOT NULL
                THEN EXCLUDED.last_success_at
                ELSE source_health_scrapers.last_success_at
              END,
            last_failure_at =
              CASE
                WHEN EXCLUDED.last_failure_at IS NOT NULL
                THEN EXCLUDED.last_failure_at
                ELSE source_health_scrapers.last_failure_at
              END
        `,
        [
          sourceId,
          input.scraperId,
          input.accessType,
          success ? 1 : 0,
          success ? 0 : 1,
          input.status,
          input.occurredAt,
          success,
        ],
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async get(sourceId: string): Promise<SourceHealthSnapshot | null> {
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();

      const sourceResult = await transaction.query<SourceHealthRow>(
        `
          SELECT *
          FROM source_health
          WHERE source_id = $1
          LIMIT 1
        `,
        [sourceId],
      );

      if (sourceResult.rows.length === 0) {
        await transaction.commit();
        return null;
      }

      const scraperResult = await transaction.query<SourceHealthScraperRow>(
        `
          SELECT
            scraper_id,
            access_type,
            total_attempts,
            successful_attempts,
            failed_attempts,
            last_access_status,
            last_attempt_at,
            last_success_at,
            last_failure_at
          FROM source_health_scrapers
          WHERE source_id = $1
          ORDER BY scraper_id
        `,
        [sourceId],
      );

      await transaction.commit();

      return this.toSnapshot(
        sourceResult.rows[0],
        scraperResult.rows,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async getByDomain(
    domain: string,
  ): Promise<SourceHealthSnapshot | null> {
    const normalizedDomain = this.normalizeDomain(domain);

    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();

      const sourceResult = await transaction.query<SourceHealthRow>(
        `
          SELECT *
          FROM source_health
          WHERE domain = $1
          LIMIT 1
        `,
        [normalizedDomain],
      );

      if (sourceResult.rows.length === 0) {
        await transaction.commit();
        return null;
      }

      const scraperResult = await transaction.query<SourceHealthScraperRow>(
        `
          SELECT
            scraper_id,
            access_type,
            total_attempts,
            successful_attempts,
            failed_attempts,
            last_access_status,
            last_attempt_at,
            last_success_at,
            last_failure_at
          FROM source_health_scrapers
          WHERE source_id = $1
          ORDER BY scraper_id
        `,
        [sourceResult.rows[0].source_id],
      );

      await transaction.commit();

      return this.toSnapshot(
        sourceResult.rows[0],
        scraperResult.rows,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async getAll(): Promise<readonly SourceHealthSnapshot[]> {
    const transaction = await this.database.createTransaction();

    try {
      await transaction.begin();

      const sourceResult = await transaction.query<SourceHealthRow>(
        `
          SELECT *
          FROM source_health
          ORDER BY source_id
        `,
      );

      const scraperResult = await transaction.query<
        SourceHealthScraperRow & { source_id: string }
      >(
        `
          SELECT
            source_id,
            scraper_id,
            access_type,
            total_attempts,
            successful_attempts,
            failed_attempts,
            last_access_status,
            last_attempt_at,
            last_success_at,
            last_failure_at
          FROM source_health_scrapers
          ORDER BY source_id, scraper_id
        `,
      );

      await transaction.commit();

      return sourceResult.rows.map((row) =>
        this.toSnapshot(
          row,
          scraperResult.rows.filter(
            (scraper) => scraper.source_id === row.source_id,
          ),
        ),
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private normalizeDomain(domain: string): string {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  private statusColumn(
    status: SourceHealthAccessRecord["status"],
  ): string | null {
    switch (status) {
      case "login-required":
        return "login_required_count";
      case "subscription-required":
        return "subscription_required_count";
      case "paywall":
        return "paywall_count";
      case "captcha":
        return "captcha_count";
      case "bot-blocked":
        return "bot_blocked_count";
      case "rate-limited":
        return "rate_limited_count";
      case "network-unavailable":
        return "network_unavailable_count";
      case "server-error":
        return "server_error_count";
      case "partial-content":
        return "partial_content_count";
      case "accessible":
      case "unknown":
        return null;
      default:
        return null;
    }
  }

  private toSnapshot(
    row: SourceHealthRow,
    scraperRows: readonly SourceHealthScraperRow[],
  ): SourceHealthSnapshot {
    const scraperStats: SourceScraperHealth[] =
      scraperRows.map((scraper) => ({
        scraperId: scraper.scraper_id,
        accessType:
          scraper.access_type as SourceScraperHealth["accessType"],
        totalAttempts: scraper.total_attempts,
        successfulAttempts: scraper.successful_attempts,
        failedAttempts: scraper.failed_attempts,
        successRate:
          scraper.total_attempts === 0
            ? 0
            : scraper.successful_attempts /
              scraper.total_attempts,
        lastAccessStatus:
          scraper.last_access_status as SourceScraperHealth["lastAccessStatus"],
        lastAttemptAt: scraper.last_attempt_at,
        lastSuccessAt: scraper.last_success_at,
        lastFailureAt: scraper.last_failure_at,
      }));

    return {
      sourceId: row.source_id,
      domain: row.domain,
      totalAttempts: row.total_attempts,
      successfulAttempts: row.successful_attempts,
      failedAttempts: row.failed_attempts,
      loginRequiredCount: row.login_required_count,
      subscriptionRequiredCount: row.subscription_required_count,
      paywallCount: row.paywall_count,
      captchaCount: row.captcha_count,
      botBlockedCount: row.bot_blocked_count,
      rateLimitedCount: row.rate_limited_count,
      networkUnavailableCount: row.network_unavailable_count,
      serverErrorCount: row.server_error_count,
      partialContentCount: row.partial_content_count,
      lastAccessStatus:
        row.last_access_status as SourceHealthSnapshot["lastAccessStatus"],
      lastAccessType:
        row.last_access_type as SourceHealthSnapshot["lastAccessType"],
      lastScraperId: row.last_scraper_id,
      lastAttemptAt: row.last_attempt_at,
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at,
      scraperStats,
    };
  }
}

