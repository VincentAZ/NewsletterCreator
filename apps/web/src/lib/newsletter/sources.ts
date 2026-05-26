import type { Article, NewsSource } from "./types";
import { loadLocalEnv } from "./env";
import { defaultScrapeSystemPrompt, defaultScrapeTaskPrompt } from "./prompts";

export const DEFAULT_SCRAPE_MODEL = "openai/gpt-4.1-mini";

type ScrapeOptions = {
  scrapeModel?: string;
  scrapeSystemPrompt?: string;
  scrapeTaskPrompt?: string;
};

export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  { id: "rss-hacker-news", name: "Hacker News", type: "rss", url: "https://news.ycombinator.com/rss", enabled: true, limit: 20 },
  { id: "rss-openai-blog", name: "OpenAI Blog", type: "rss", url: "https://openai.com/news/rss.xml", enabled: true, limit: 20 },
  { id: "rss-simon-willison", name: "Simon Willison", type: "rss", url: "https://simonwillison.net/atom/everything/", enabled: true, limit: 20 },
  { id: "rss-verge-ai", name: "The Verge AI", type: "rss", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", enabled: true, limit: 20 },
  { id: "rss-hugging-face", name: "Hugging Face", type: "rss", url: "https://huggingface.co/blog/feed.xml", enabled: true, limit: 20 },
  { id: "rss-venturebeat-ai", name: "VentureBeat AI", type: "rss", url: "https://venturebeat.com/category/ai/feed/", enabled: true, limit: 20 },
  { id: "rss-latent-space", name: "Latent Space", type: "rss", url: "https://www.latent.space/feed", enabled: true, limit: 20 },
  { id: "site-anthropic-news", name: "Anthropic News", type: "website", url: "https://www.anthropic.com/news", enabled: true, limit: 20 },
];

export async function gatherArticles(
  sources: NewsSource[] = DEFAULT_NEWS_SOURCES,
  options: ScrapeOptions = {},
): Promise<{ articles: Article[]; sourceCount: number }> {
  const enabledSources = normalizeSources(sources).filter((source) => source.enabled);
  const results = await Promise.allSettled(enabledSources.map((source) => fetchSource(source, options)));
  const articles = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return {
    articles: dedupeArticles(articles).sort((a, b) => b.score - a.score).slice(0, 60),
    sourceCount: enabledSources.length,
  };
}

export function normalizeSources(sources: NewsSource[]): NewsSource[] {
  return sources
    .map((source) => {
      const rawType = (source as NewsSource & { type?: string }).type;
      const type: NewsSource["type"] = rawType === "rss" ? "rss" : "website";
      return {
        ...source,
        id: source.id || stableId(`${source.name}-${source.url}`),
        name: source.name.trim(),
        type,
        url: source.url.trim(),
        limit: Math.max(1, Math.min(Number(source.limit) || 20, 100)),
        query: source.query?.trim(),
      };
    })
    .filter((source) => source.name && source.url);
}

async function fetchSource(source: NewsSource, options: ScrapeOptions): Promise<Article[]> {
  if (source.type === "website") {
    return scrapeWebsiteSource(source, options);
  }
  return fetchRssSource(source);
}

async function fetchRssSource(source: NewsSource): Promise<Article[]> {
  const response = await fetch(source.url, { headers: { "user-agent": "GodModeNewsletter/1.0" }, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${source.name} failed with ${response.status}`);
  }
  return parseFeed(await response.text(), source.name).slice(0, source.limit);
}

async function scrapeWebsiteSource(source: NewsSource, options: ScrapeOptions): Promise<Article[]> {
  let directArticles: Article[] = [];

  try {
    const response = await fetch(source.url, {
      headers: websiteHeaders("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`${source.name} failed with ${response.status}`);
    }
    directArticles = await scrapeWebsiteWithAi(await response.text(), source, options);
    if (directArticles.length >= source.limit) {
      return directArticles.slice(0, source.limit);
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes("AI source scraping") || error.message.includes("OPENROUTER_API_KEY"))) {
      throw error;
    }
    directArticles = [];
  }

  const fallbackArticles = await fetchWebsiteNewsFallback(source, options);
  const combinedArticles = dedupeArticles([...directArticles, ...fallbackArticles])
    .sort((a, b) => b.score - a.score)
    .slice(0, source.limit);

  if (combinedArticles.length > 0) {
    return combinedArticles;
  }
  throw new Error(`${source.name} did not return scrapeable website articles.`);
}

async function fetchWebsiteNewsFallback(source: NewsSource, options: ScrapeOptions): Promise<Article[]> {
  const hostname = hostnameFor(source.url);
  if (!hostname) {
    return [];
  }

  const query = encodeURIComponent(`${siteSearchQuery(hostname)} ${source.query || "AI"}`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: websiteHeaders("application/rss+xml,application/xml,text/xml,*/*;q=0.8"),
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }

  return selectFeedArticlesWithAi(parseFeed(await response.text(), source.name), source, options);
}

async function scrapeWebsiteWithAi(html: string, source: NewsSource, options: ScrapeOptions): Promise<Article[]> {
  loadLocalEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for AI website source scraping.");
  }

  const pageTitle = cleanText(extractTag(html, "title"));
  const candidates = extractWebsiteLinkCandidates(html, source.url).slice(0, 80);
  const aiCandidates = candidates.length > 0 ? candidates : pageTitle ? [{ title: pageTitle, url: source.url, summary: "Page title fallback" }] : [];
  if (aiCandidates.length === 0) {
    return [];
  }
  const model = options.scrapeModel?.trim() || process.env.OPENROUTER_SCRAPE_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_SCRAPE_MODEL;
  const content = await askAiSourceScraper({
    model,
    apiKey,
    systemPrompt: options.scrapeSystemPrompt,
    taskPrompt: options.scrapeTaskPrompt,
    source,
    pageTitle,
    candidates: aiCandidates,
  });

  const parsed = parseAiArticleSelection(content);
  return parsed
    .map((article): Article | null => {
      const url = resolveUrl(article.url, source.url);
      const title = cleanText(article.title);
      if (!url || !title) {
        return null;
      }
      const summary = cleanText(article.summary).slice(0, 500) || `Story selected by AI from ${source.name}.`;
      return {
        id: stableId(url),
        title,
        url,
        source: source.name,
        summary,
        published: null,
        score: scoreArticle(title, summary, "", source.name),
      };
    })
    .filter((article): article is Article => article !== null)
    .slice(0, source.limit);
}

async function selectFeedArticlesWithAi(articles: Article[], source: NewsSource, options: ScrapeOptions): Promise<Article[]> {
  loadLocalEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || articles.length === 0) {
    return [];
  }

  const model = options.scrapeModel?.trim() || process.env.OPENROUTER_SCRAPE_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_SCRAPE_MODEL;
  const content = await askAiSourceScraper({
    model,
    apiKey,
    systemPrompt: options.scrapeSystemPrompt,
    taskPrompt: options.scrapeTaskPrompt,
    source,
    pageTitle: `${source.name} fallback feed`,
    candidates: articles.slice(0, 80).map((article) => ({
      title: article.title,
      url: article.url,
      summary: article.summary,
      published: article.published,
    })),
  });
  const selectedUrls = new Set(parseAiArticleSelection(content).map((article) => normalizeUrl(resolveUrl(article.url, source.url))));
  return articles.filter((article) => selectedUrls.has(normalizeUrl(article.url))).slice(0, source.limit);
}

async function askAiSourceScraper(input: {
  model: string;
  apiKey: string;
  systemPrompt?: string;
  taskPrompt?: string;
  source: NewsSource;
  pageTitle: string;
  candidates: Array<{ title: string; url: string; summary?: string; published?: string | null }>;
}) {
  const userPrompt = buildScrapeTaskPrompt(input);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        {
          role: "system",
          content: (input.systemPrompt?.trim() || defaultScrapeSystemPrompt)
            .replaceAll("{{currentDate}}", new Date().toISOString().slice(0, 10)),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI source scraping failed for ${input.source.name} with ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

function buildScrapeTaskPrompt(input: {
  taskPrompt?: string;
  source: NewsSource;
  pageTitle: string;
  candidates: Array<{ title: string; url: string; summary?: string; published?: string | null }>;
}) {
  const candidatesJson = JSON.stringify(input.candidates);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 3);
  const currentDate = now.toISOString().slice(0, 10);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const template = input.taskPrompt?.trim() || defaultScrapeTaskPrompt;
  const rendered = template
    .replaceAll("{{sourceName}}", input.source.name)
    .replaceAll("{{sourceUrl}}", input.source.url)
    .replaceAll("{{pageTitle}}", input.pageTitle || "unknown")
    .replaceAll("{{maxArticles}}", String(input.source.limit))
    .replaceAll("{{currentDate}}", currentDate)
    .replaceAll("{{cutoffDate}}", cutoffDate)
    .replaceAll("{{candidatesJson}}", candidatesJson);

  return rendered.includes(candidatesJson) ? rendered : `${rendered}\n\nLink candidates:\n${candidatesJson}`;
}

function extractWebsiteLinkCandidates(html: string, baseUrl: string) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const url = resolveUrl(match[1] ?? "", baseUrl);
      const title = cleanText(match[2] ?? "");
      if (!url || !title || title.length < 12) {
        return null;
      }
      return {
        title,
        url,
      };
    })
    .filter((candidate): candidate is { title: string; url: string } => candidate !== null)
    .filter((candidate, index, all) => all.findIndex((item) => normalizeUrl(item.url) === normalizeUrl(candidate.url)) === index);
}

function parseAiArticleSelection(content: string): Array<{ title: string; url: string; summary: string }> {
  try {
    const value = JSON.parse(content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "")) as {
      articles?: Array<{ title?: unknown; url?: unknown; summary?: unknown }>;
    };
    return (value.articles ?? [])
      .filter((item) => typeof item.title === "string" && typeof item.url === "string")
      .map((item) => ({
        title: item.title as string,
        url: item.url as string,
        summary: typeof item.summary === "string" ? item.summary : "",
      }));
  } catch {
    return [];
  }
}

function parseFeed(xml: string, source: string): Article[] {
  const blocks = matchBlocks(xml, "item").length ? matchBlocks(xml, "item") : matchBlocks(xml, "entry");
  return blocks
    .map((block): Article | null => {
      const title = extractTag(block, "title");
      const url = extractTag(block, "link") || extractAtomLink(block);
      const summary = extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content");
      const published = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
      if (!title || !url) return null;
      return {
        id: stableId(url),
        title: cleanText(title),
        url: decodeHtml(url).trim(),
        source,
        summary: cleanText(summary).slice(0, 500),
        published: toIso(published),
        score: scoreArticle(title, summary, published, source),
      };
    })
    .filter((article): article is Article => article !== null);
}

function matchBlocks(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => match[1] ?? "");
}

function extractTag(block: string, tag: string) {
  return block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() ?? "";
}

function extractAtomLink(block: string) {
  return block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(value: string) {
  return stripTags(decodeHtml(stripTags(decodeHtml(value)))).replace(/\s+/g, " ").trim();
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash << 5) - hash + value.charCodeAt(index);
  return Math.abs(hash | 0).toString(36);
}

function dedupeArticles(articles: Article[]) {
  const seen = new Map<string, Article>();
  for (const article of articles) {
    const key = normalizeUrl(article.url) || article.title.toLowerCase();
    const existing = seen.get(key);
    if (!existing || article.score > existing.score) seen.set(key, article);
  }
  return [...seen.values()];
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

function resolveUrl(url: string, baseUrl: string) {
  try {
    const parsed = new URL(url, baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function siteSearchQuery(hostname: string) {
  const hosts = equivalentHostnames(hostname);
  return hosts.map((host) => `site:${host}`).join(" OR ");
}

function equivalentHostnames(hostname: string) {
  if (hostname === "the-decoder.de" || hostname === "the-decoder.com") {
    return ["the-decoder.com", "the-decoder.de"];
  }
  return [hostname];
}

function websiteHeaders(accept: string) {
  return {
    "accept": accept,
    "accept-language": "en-US,en;q=0.9",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
}

function scoreArticle(title: string, summary: string, published: string, source: string) {
  const haystack = `${title} ${summary}`.toLowerCase();
  const relevance = ["ai", "llm", "openai", "anthropic", "model", "agent", "inference", "gpu", "safety"].reduce((score, term) => score + (haystack.includes(term) ? 8 : 0), 0);
  const ageScore = published ? Math.max(0, 30 - ageInDays(published) * 4) : 5;
  const sourceBoost = source.includes("OpenAI") || source.includes("Hugging") ? 12 : 0;
  return Math.round(40 + relevance + ageScore + sourceBoost);
}

function ageInDays(dateString: string) {
  const time = new Date(dateString).getTime();
  return Number.isNaN(time) ? 7 : (Date.now() - time) / 86400000;
}

function toIso(dateString: string) {
  const time = new Date(decodeHtml(dateString)).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
