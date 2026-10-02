import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  ArticleCaptureLogEntry,
  ArticleSourceCaptureLog,
  ArticleSourceRecord,
} from "@atlas/core";

interface Store { sources: ArticleSourceRecord[]; logs: ArticleCaptureLogEntry[] }

export class FileSourceCaptureLog implements ArticleSourceCaptureLog {
  private queue: Promise<void> = Promise.resolve();
  public constructor(private readonly filePath: string) {}

  public async listSources(): Promise<readonly ArticleSourceRecord[]> {
    await this.queue;
    return (await this.read()).sources;
  }

  public async beginBatch(urls: readonly string[]): Promise<string> {
    const batchId = randomUUID();
    await this.mutate((store) => {
      const now = new Date().toISOString();
      for (const sourceUrl of urls) {
        const source = store.sources.find((entry) => entry.sourceUrl === sourceUrl);
        if (source) Object.assign(source, { lastStatus: "queued", lastError: null, updatedAt: now });
        else store.sources.push({ sourceUrl, language: null, region: null, lastStatus: "queued", lastError: null, updatedAt: now });
        store.logs.push({ batchId, sourceUrl, status: "queued", details: null, capturedAt: now });
      }
    });
    return batchId;
  }

  public async complete(batchId: string, sourceUrl: string, result: {
    status: "success" | "failed"; details: string | null; language?: string | null; region?: string | null;
  }): Promise<void> {
    await this.mutate((store) => {
      const now = new Date().toISOString();
      const log = [...store.logs].reverse().find((entry) => entry.batchId === batchId && entry.sourceUrl === sourceUrl && entry.status === "queued");
      if (log) Object.assign(log, { status: result.status, details: result.details, capturedAt: now });
      const source = store.sources.find((entry) => entry.sourceUrl === sourceUrl);
      if (source) Object.assign(source, {
        lastStatus: result.status,
        lastError: result.status === "failed" ? result.details : null,
        language: result.language ?? source.language,
        region: result.region ?? source.region,
        updatedAt: now,
      });
    });
  }

  private async mutate(change: (store: Store) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const store = await this.read();
      change(store);
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(store), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    this.queue = operation.catch(() => undefined);
    await operation;
  }

  private async read(): Promise<Store> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid source log file.");
      const value = parsed as Partial<Store>;
      return { sources: Array.isArray(value.sources) ? value.sources : [], logs: Array.isArray(value.logs) ? value.logs : [] };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { sources: [], logs: [] };
      throw error;
    }
  }
}
