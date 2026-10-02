import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BrowserScraper,
  CaptureArticle,
  DefaultScraperSelectionPolicy,
  HttpScraper,
  PostgreSQLArticleSnapshotRepository,
  PostgreSQLArticleSourceCaptureLog,
  PostgreSQLDatabase,
  ScraperOrchestratorAdapter,
  SystemClock,
} from "@atlas/core";
import type { ArticleSnapshot, ArticleSnapshotRepository, ArticleSourceCaptureLog } from "@atlas/core";
import { FileArticleSnapshotRepository } from "./file-article-snapshot-repository.js";
import { FileSourceCaptureLog } from "./file-source-capture-log.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const maximumArticleAddresses = 500;
const fileArchive = new FileArticleSnapshotRepository(
  join(app.getPath("userData"), "article-archive.json")
);
const fileSourceCaptureLog = new FileSourceCaptureLog(
  join(app.getPath("userData"), "source-capture-log.json")
);
let archive: ArticleSnapshotRepository = fileArchive;
let sourceCaptureLog: ArticleSourceCaptureLog = fileSourceCaptureLog;
let database: PostgreSQLDatabase | null = null;
const scraper = new ScraperOrchestratorAdapter(
  [new HttpScraper(), new BrowserScraper()],
  new DefaultScraperSelectionPolicy()
);
let captureArticle = new CaptureArticle(scraper, archive, new SystemClock());

interface ArticleSummary {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly contentType: string | null;
  readonly fetchedAt: string;
  readonly scraperId: string;
  readonly language: string | null;
  readonly region: string | null;
}

function summary(article: ArticleSnapshot): ArticleSummary {
  return {
    sourceUrl: article.sourceUrl,
    finalUrl: article.finalUrl,
    contentType: article.contentType,
    fetchedAt: article.fetchedAt,
    scraperId: article.scraperId,
    language: article.language,
    region: article.region,
  };
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: "#f4f6f8",
    title: "Atlas Haber Arşivi",
    webPreferences: {
      preload: join(currentDirectory, "../src/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void window.loadFile(join(currentDirectory, "../renderer/dist/index.html"));
}

ipcMain.handle("articles:list", async () => {
  const articles = await archive.findRecent(100);
  return articles.map(summary);
});

ipcMain.handle("sources:list", async () => sourceCaptureLog.listSources());

ipcMain.handle("articles:get", async (_event, sourceUrl: unknown) => {
  if (typeof sourceUrl !== "string") {
    throw new Error("Article address is required.");
  }

  const article = await archive.findById(sourceUrl);
  return article ? { ...summary(article), html: article.html } : null;
});

ipcMain.handle("articles:capture", async (event, rawUrls: unknown) => {
  if (
    !Array.isArray(rawUrls) ||
    rawUrls.length === 0 ||
    rawUrls.length > maximumArticleAddresses
  ) {
    throw new Error(`Enter between 1 and ${maximumArticleAddresses} article addresses.`);
  }

  const entries = rawUrls.map((value, index) => {
    const url = typeof value === "string" ? value.trim() : "";
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      return { index, url, sourceKey: parsed.toString() };
    } catch {
      return { index, url, sourceKey: url };
    }
  });
  const sourceKeys = entries.filter(({ url }) => url).map(({ sourceKey }) => sourceKey);
  const batchId = await sourceCaptureLog.beginBatch(sourceKeys);
  const results: Array<
    | { success: true; article: ArticleSummary }
    | { success: false; url: string; error: string }
  > = new Array(entries.length);
  const validEntries = entries.filter(({ url }) => url);
  let processed = 0;
  event.sender.send("articles:capture:progress", { processed, total: validEntries.length, phase: "started" });

  for (let start = 0; start < validEntries.length; start += 5) {
    const group = validEntries.slice(start, start + 5);
    await Promise.all(group.map(async ({ index, url, sourceKey }) => {
      event.sender.send("articles:capture:progress", {
        processed, total: validEntries.length, url, phase: "fetching",
      });
      let succeeded = false;
      let failureMessage: string | null = null;
      try {
        const article = await captureArticle.execute({ url });
        await sourceCaptureLog.complete(batchId, article.sourceUrl, {
          status: "success", details: null, language: article.language, region: article.region,
        });
        results[index] = { success: true, article: summary(article) };
        succeeded = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failureMessage = message;
        await sourceCaptureLog.complete(batchId, sourceKey, {
          status: "failed", details: message,
        });
        results[index] = { success: false, url, error: message };
      } finally {
        processed += 1;
        event.sender.send("articles:capture:progress", {
          processed, total: validEntries.length, url, phase: "completed",
          success: succeeded, error: failureMessage,
        });
      }
    }));
  }

  for (const { index, url } of entries.filter(({ url }) => !url)) {
    results[index] = { success: false, url, error: "Empty address." };
  }
  return results;
});

app.whenReady().then(async () => {
  const connectionString = process.env.ATLAS_DATABASE_URL;
  if (connectionString) {
    database = new PostgreSQLDatabase({ connectionString });
    await database.connect();
    archive = new PostgreSQLArticleSnapshotRepository(database);
    sourceCaptureLog = new PostgreSQLArticleSourceCaptureLog(database);
    captureArticle = new CaptureArticle(scraper, archive, new SystemClock());
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  if (database) void database.disconnect();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
