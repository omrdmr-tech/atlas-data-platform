import { app, BrowserWindow, ipcMain } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BrowserScraper,
  CaptureArticle,
  DefaultScraperSelectionPolicy,
  HttpScraper,
  ScraperOrchestratorAdapter,
  SystemClock,
} from "@atlas/core";
import type { ArticleSnapshot } from "@atlas/core";
import { FileArticleSnapshotRepository } from "./file-article-snapshot-repository.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const maximumArticleAddresses = 500;
const archive = new FileArticleSnapshotRepository(
  join(app.getPath("userData"), "article-archive.json")
);
const scraper = new ScraperOrchestratorAdapter(
  [new HttpScraper(), new BrowserScraper()],
  new DefaultScraperSelectionPolicy()
);
const captureArticle = new CaptureArticle(scraper, archive, new SystemClock());

interface ArticleSummary {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly contentType: string | null;
  readonly fetchedAt: string;
  readonly scraperId: string;
}

function summary(article: ArticleSnapshot): ArticleSummary {
  return {
    sourceUrl: article.sourceUrl,
    finalUrl: article.finalUrl,
    contentType: article.contentType,
    fetchedAt: article.fetchedAt,
    scraperId: article.scraperId,
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

ipcMain.handle("articles:get", async (_event, sourceUrl: unknown) => {
  if (typeof sourceUrl !== "string") {
    throw new Error("Article address is required.");
  }

  const article = await archive.findById(sourceUrl);
  return article ? { ...summary(article), html: article.html } : null;
});

ipcMain.handle("articles:capture", async (_event, rawUrls: unknown) => {
  if (
    !Array.isArray(rawUrls) ||
    rawUrls.length === 0 ||
    rawUrls.length > maximumArticleAddresses
  ) {
    throw new Error(`Enter between 1 and ${maximumArticleAddresses} article addresses.`);
  }

  const results = [];

  for (const value of rawUrls) {
    const url = typeof value === "string" ? value.trim() : "";

    if (!url) {
      results.push({ success: false, url: "", error: "Empty address." });
      continue;
    }

    try {
      const article = await captureArticle.execute({ url });
      results.push({ success: true, article: summary(article) });
    } catch (error) {
      results.push({
        success: false,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
