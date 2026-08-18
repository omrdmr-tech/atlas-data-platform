import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpScraper } from "./http-scraper.js";

function createResponse(options: {
  url: string;
  status: number;
  content: string;
  contentType?: string | null;
}): Response {
  const response = new Response(options.content, {
    status: options.status,
    headers: options.contentType
      ? {
          "content-type": options.contentType,
        }
      : undefined,
  });

  Object.defineProperty(response, "url", {
    value: options.url,
  });

  return response;
}