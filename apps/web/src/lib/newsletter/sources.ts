import type { Article, NewsSource } from "./types";

export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  { id: "rss-hacker-news", name: "Hacker News", type: "rss", url: "https://news.ycombinator.com/rss", enabled: true, limit: 20 },
  { id: "rss-openai-blog", name: "OpenAI Blog", type: "rss", url: "https://openai.com/news/rss.xml", enabled: true, limit: 20 },
  { id: "rss-simon-willison", name: "Simon Willison", type: "rss", url: "https://simonwillison.net/atom/everything/", enabled: true, limit: 20 },
  { id: "rss-verge-ai", name: "The Verge AI", type: "rss", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", enabled: true, limit: 20 },
  { id: "rss-hugging-face", name: "Hugging Face", type: "rss", url: "https://huggingface.co/blog/feed.xml", enabled: true, limit: 20 },
  { id: "rss-venturebeat-ai", name: "VentureBeat AI", type: "rss", url: "https://venturebeat.com/category/ai/feed/", enabled: true, limit: 20 },
  { id: "rss-latent-space", name: "Latent Space", type: "rss", url: "https://www.latent.space/feed", enabled: true, limit: 20 },
  {
    id: "hn-algolia-ai",
    name: "HN Algolia AI",
    type: "hn_algolia",
    url: "https://hn.algolia.com/api/v1/search_by_date",
    enabled: true,
    limit: 20,
    query: "AI OR artificial intelligence OR LLM OR OpenAI OR Anthropic OR model",
  },
];

export async function gatherArticles(sources: NewsSource[] = DEFAULT_NEWS_SOURCES): Promise<{ articles: Article[]; sourceCount: number }> {
  const enabledSources = normalizeSources(sources).filter((source) => source.enabled);
  const results = await Promise.allSettled(enabledSources.map(fetchSource));
  const articles = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return {
    articles: dedupeArticles(articles).sort((a, b) => b.score - a.score).slice(0, 60),
    sourceCount: enabledSources.length,
  };
}

export function normalizeSources(sources: NewsSource[]) {
  return sources
    .map((source) => ({
      ...source,
      id: source.id || stableId(`${source.name}-${source.url}`),
      name: source.name.trim(),
      url: source.url.trim(),
      limit: Math.max(1, Math.min(Number(source.limit) || 20, 100)),
      query: source.query?.trim(),
    }))
    .filter((source) => source.name && source.url);
}

async function fetchSource(source: NewsSource): Promise<Article[]> {
  if (source.type === "hn_algolia") {
    return fetchHackerNewsAlgolia(source);
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

async function fetchHackerNewsAlgolia(source: NewsSource): Promise<Article[]> {
  const params = new URLSearchParams({
    query: source.query || "AI OR artificial intelligence OR LLM OR OpenAI OR Anthropic OR model",
    tags: "story",
    numericFilters: `created_at_i>${Math.floor(Date.now() / 1000) - 86400 * 3}`,
    hitsPerPage: String(source.limit),
  });
  try {
    const response = await fetch(`${source.url}?${params}`, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = (await response.json()) as { hits?: Array<{ title?: string; story_title?: string; url?: string; story_url?: string; created_at?: string; points?: number }> };
    return (payload.hits ?? [])
      .map((hit): Article | null => {
        const title = hit.title ?? hit.story_title;
        const url = hit.url ?? hit.story_url;
        return title && url
          ? { id: stableId(url), title: decodeHtml(title), url, source: source.name, summary: "Recent Hacker News story matched by the AI-news search query.", published: hit.created_at ?? null, score: 65 + Math.min(hit.points ?? 0, 200) / 10 }
          : null;
      })
      .filter((article): article is Article => article !== null);
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
        title: decodeHtml(stripTags(title)).trim(),
        url: decodeHtml(url).trim(),
        source,
        summary: decodeHtml(stripTags(summary)).replace(/\s+/g, " ").trim().slice(0, 500),
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
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
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
