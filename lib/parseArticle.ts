import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export type ParsedArticle = {
  date: string | null;
  title: string | null;
  content: string | null;
};

const TITLE_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  "article h1",
  ".post h1",
  ".content h1",
  "h1",
  "title",
];

const DATE_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[property="og:published_time"]',
  'meta[name="article:published_time"]',
  'meta[name="publish-date"]',
  'meta[name="publishdate"]',
  'meta[name="pubdate"]',
  'meta[name="date"]',
  'meta[name="DC.date"]',
  'meta[name="dc.date"]',
  'meta[itemprop="datePublished"]',
];

const DATE_TEXT_SELECTORS = [
  "time[datetime]",
  "time",
  "[itemprop='datePublished']",
  ".published",
  ".post-date",
  ".entry-date",
  ".article-date",
  ".date",
];

const CONTENT_SELECTORS = [
  "article",
  "[itemprop='articleBody']",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".article-body",
  ".post-body",
  ".story-body",
  ".post",
  ".content",
  "main",
  "#content",
  "#main-content",
];

const JUNK_SELECTORS = [
  "script",
  "style",
  "nav",
  "aside",
  "footer",
  "header",
  "noscript",
  "iframe",
  "form",
  ".comments",
  ".comment",
  ".sidebar",
  ".share",
  ".related",
  ".advertisement",
  ".ads",
  ".social",
].join(", ");

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function metaContent($: CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr("content")?.trim();
  return value || null;
}

function extractJsonLd($: CheerioAPI): Partial<ParsedArticle> {
  const result: Partial<ParsedArticle> = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).contents().text());
      const nodes = flattenLd(parsed);

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const item = node as Record<string, unknown>;
        const type = String(item["@type"] ?? "");

        if (!/Article|NewsArticle|BlogPosting|WebPage/i.test(type) && !item.headline) {
          continue;
        }

        if (!result.title && typeof item.headline === "string") {
          result.title = collapse(item.headline);
        }
        if (!result.date && typeof item.datePublished === "string") {
          result.date = item.datePublished.trim();
        }
        if (!result.content && typeof item.articleBody === "string") {
          result.content = collapse(item.articleBody);
        }
      }
    } catch {
      // Некорректный JSON-LD пропускаем.
    }
  });

  return result;
}

function flattenLd(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenLd);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = record["@graph"];
    if (Array.isArray(nested)) {
      return [record, ...nested.flatMap(flattenLd)];
    }
    return [record];
  }

  return [];
}

function extractTitle($: CheerioAPI): string | null {
  for (const selector of TITLE_SELECTORS) {
    const node = $(selector).first();
    if (!node.length) continue;

    const fromAttr = node.attr("content")?.trim();
    if (fromAttr) return collapse(fromAttr);

    const text = collapse(node.text());
    if (text) return text;
  }

  return null;
}

function extractDate($: CheerioAPI): string | null {
  for (const selector of DATE_META_SELECTORS) {
    const value = metaContent($, selector);
    if (value) return value;
  }

  for (const selector of DATE_TEXT_SELECTORS) {
    const node = $(selector).first();
    if (!node.length) continue;

    const datetime = node.attr("datetime")?.trim() || node.attr("content")?.trim();
    if (datetime) return datetime;

    const text = collapse(node.text());
    if (text) return text;
  }

  return null;
}

function extractContent($: CheerioAPI): string | null {
  for (const selector of CONTENT_SELECTORS) {
    const node = $(selector).first().clone();
    if (!node.length) continue;

    node.find(JUNK_SELECTORS).remove();

    const paragraphs = node
      .find("p")
      .map((_, el) => collapse($(el).text()))
      .get()
      .filter((text) => text.length > 40);

    if (paragraphs.length >= 2) {
      return paragraphs.join("\n\n");
    }

    const text = collapse(node.text());
    if (text.length > 200) return text;
  }

  return null;
}

export function parseArticleHtml(html: string): ParsedArticle {
  const $ = cheerio.load(html);
  const fromLd = extractJsonLd($);

  return {
    date: fromLd.date ?? extractDate($),
    title: fromLd.title ?? extractTitle($),
    content: fromLd.content ?? extractContent($),
  };
}
