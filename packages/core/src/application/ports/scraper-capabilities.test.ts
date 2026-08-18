import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  ScraperCapability,
  ScraperDescriptor,
} from "./scraper-capabilities.js";

test("ScraperDescriptor exposes scraper capabilities", () => {
  const descriptor: ScraperDescriptor = {
    scraperId: "http-scraper",
    capabilities: ["http"],
  };

  assert.equal(descriptor.scraperId, "http-scraper");
  assert.deepEqual(descriptor.capabilities, ["http"]);
});

test("ScraperDescriptor supports multiple capabilities", () => {
  const capabilities: readonly ScraperCapability[] = [
    "browser",
    "javascript",
    "anti-bot",
  ];

  const descriptor: ScraperDescriptor = {
    scraperId: "browser-scraper",
    capabilities,
  };

  assert.deepEqual(
    descriptor.capabilities,
    capabilities
  );
});
