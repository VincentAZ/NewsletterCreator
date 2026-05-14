"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  Article,
  Balances,
  GeneratedImage,
  MailchimpCampaignDraft,
  MailchimpSectionMap,
  NewsSource,
  NewsletterPreferences,
  NewsletterDraft,
  NewsletterSection,
  ProviderBalance,
  ProviderModel,
  ValidationResult,
} from "@/lib/newsletter/types";

type ModelsPayload = {
  openRouterModels: ProviderModel[];
  falModels: ProviderModel[];
  modelErrors: { openRouter: string | null; fal: string | null };
  balances: Balances;
};

type ArticlesPayload = {
  articles: Article[];
  sourceCount: number;
  sources?: NewsSource[];
  error?: string;
  balances: Balances;
};

type DraftPayload = {
  draft: NewsletterDraft;
  validation: ValidationResult;
  usedFallback: boolean;
  raw?: string;
  error?: string;
  balances: Balances;
};

type ImagePayload = {
  image?: GeneratedImage;
  error?: string;
  balances: Balances;
};

type PreferencesPayload = {
  configured: boolean;
  preferences: NewsletterPreferences | null;
  error?: string;
};

type MailchimpPayload = {
  campaign?: MailchimpCampaignDraft;
  error?: string;
};

const preferenceIdKey = "newsletterCreator.preferenceId.v1";
const localPreferencesKey = "newsletterCreator.preferences.v1";

const emptyBalances: Balances = {
  openRouter: {
    provider: "openrouter",
    status: "unavailable",
    label: "OpenRouter",
    balance: null,
    currency: "USD",
    updatedAt: "",
  },
  fal: {
    provider: "fal",
    status: "unavailable",
    label: "fal.ai",
    balance: null,
    currency: "USD",
    updatedAt: "",
  },
};

const defaultNewsSources: NewsSource[] = [
  { id: "rss-hacker-news", name: "Hacker News", type: "rss", url: "https://news.ycombinator.com/rss", enabled: true, limit: 20 },
  { id: "rss-openai-blog", name: "OpenAI Blog", type: "rss", url: "https://openai.com/news/rss.xml", enabled: true, limit: 20 },
  { id: "rss-simon-willison", name: "Simon Willison", type: "rss", url: "https://simonwillison.net/atom/everything/", enabled: true, limit: 20 },
  { id: "rss-verge-ai", name: "The Verge AI", type: "rss", url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", enabled: true, limit: 20 },
  { id: "rss-hugging-face", name: "Hugging Face", type: "rss", url: "https://huggingface.co/blog/feed.xml", enabled: true, limit: 20 },
  { id: "rss-venturebeat-ai", name: "VentureBeat AI", type: "rss", url: "https://venturebeat.com/category/ai/feed/", enabled: true, limit: 20 },
  { id: "rss-latent-space", name: "Latent Space", type: "rss", url: "https://www.latent.space/feed", enabled: true, limit: 20 },
  { id: "site-anthropic-news", name: "Anthropic News", type: "website", url: "https://www.anthropic.com/news", enabled: true, limit: 20 },
];

const emptySourceDraft: NewsSource = {
  id: "",
  name: "",
  type: "rss",
  url: "",
  enabled: true,
  limit: 20,
  query: "",
};

const defaultMailchimpSectionMap: MailchimpSectionMap = {
  preheader: "preheader",
  intro: "intro",
  heroImage: "hero_image",
  body: "body",
};

export function NewsletterDashboard() {
  const [openRouterModels, setOpenRouterModels] = useState<ProviderModel[]>([]);
  const [falModels, setFalModels] = useState<ProviderModel[]>([]);
  const [sources, setSources] = useState<NewsSource[]>(defaultNewsSources);
  const [sourceDraft, setSourceDraft] = useState<NewsSource>(emptySourceDraft);
  const [showAddSource, setShowAddSource] = useState(false);
  const [copyModel, setCopyModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [copyModelSearch, setCopyModelSearch] = useState("");
  const [imageModelSearch, setImageModelSearch] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [articleSourceFilter, setArticleSourceFilter] = useState<string>("all");
  const [expandedSourceIds, setExpandedSourceIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<NewsletterDraft | null>(null);
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [balances, setBalances] = useState<Balances>(emptyBalances);
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [imageFeedback, setImageFeedback] = useState("");
  const [mailchimpTemplateId, setMailchimpTemplateId] = useState("");
  const [mailchimpSectionMap, setMailchimpSectionMap] = useState<MailchimpSectionMap>(defaultMailchimpSectionMap);
  const [mailchimpCampaign, setMailchimpCampaign] = useState<MailchimpCampaignDraft | null>(null);
  const [status, setStatus] = useState("Load models and sources to start.");
  const [isBusy, setIsBusy] = useState(false);
  const [preferenceId, setPreferenceId] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const lastSavedPreferences = useRef("");

  const selectedArticles = useMemo(() => {
    return articles.filter((article) => selectedArticleIds.has(article.id));
  }, [articles, selectedArticleIds]);
  const enabledSourceCount = sources.filter((source) => source.enabled).length;
  const totalSourceCount = sources.length;

  const articleSourceNames = useMemo(() => {
    return Array.from(new Set(articles.map((article) => article.source)));
  }, [articles]);

  const visibleArticles = useMemo(() => {
    if (articleSourceFilter === "all") {
      return articles;
    }
    return articles.filter((article) => article.source === articleSourceFilter);
  }, [articles, articleSourceFilter]);
  const filteredOpenRouterModels = useMemo(() => {
    return filterModels(openRouterModels, copyModelSearch);
  }, [copyModelSearch, openRouterModels]);
  const filteredFalModels = useMemo(() => {
    return filterModels(falModels, imageModelSearch);
  }, [falModels, imageModelSearch]);
  const selectedCopyModel = useMemo(() => {
    return openRouterModels.find((model) => model.id === copyModel) ?? null;
  }, [copyModel, openRouterModels]);
  const selectedImageModel = useMemo(() => {
    return falModels.find((model) => model.id === imageModel) ?? null;
  }, [falModels, imageModel]);

  const canGenerateDraft = copyModel && selectedArticles.length > 0 && !isBusy;
  const canGenerateImage = draft?.imagePrompt.trim() && imageModel && !isBusy;
  const canPopulateMailchimp = Boolean(draft && image && !isBusy);
  const currentStep = getCurrentStep({
    modelsLoaded: openRouterModels.length > 0 && falModels.length > 0,
    articlesLoaded: articles.length > 0,
    draftReady: Boolean(draft),
    imageReady: Boolean(image),
    mailchimpReady: Boolean(mailchimpCampaign),
  });

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState() {
      const id = getOrCreatePreferenceId();
      setPreferenceId(id);

      const preferencesPayload = await fetchJson<PreferencesPayload>(
        `/api/newsletter/preferences?preferenceId=${encodeURIComponent(id)}`,
      );
      const preferences = preferencesPayload.configured ? preferencesPayload.preferences : loadLocalPreferences();

      if (preferences?.sources.length) {
        setSources(normalizeDashboardSources(preferences.sources));
      }
      if (preferences?.copyModel) {
        setCopyModel(preferences.copyModel);
      }
      if (preferences?.imageModel) {
        setImageModel(preferences.imageModel);
      }
      lastSavedPreferences.current = serializePreferences({
        sources: preferences?.sources.length ? preferences.sources : defaultNewsSources,
        copyModel: preferences?.copyModel ?? "",
        imageModel: preferences?.imageModel ?? "",
      });

      const payload = await fetchJson<{ balances: Balances }>("/api/newsletter/balances");
      if (isMounted) {
        setBalances(payload.balances);
        setPreferencesLoaded(true);
      }
    }

    void loadInitialState().catch(() => {
      if (isMounted) {
        const preferences = loadLocalPreferences();
        if (preferences?.sources.length) {
          setSources(normalizeDashboardSources(preferences.sources));
        }
        if (preferences?.copyModel) {
          setCopyModel(preferences.copyModel);
        }
        if (preferences?.imageModel) {
          setImageModel(preferences.imageModel);
        }
        setPreferencesLoaded(true);
        setStatus("Preferences or balance check failed. Load models to retry provider checks.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || !preferenceId) {
      return;
    }

    const preferences = { sources, copyModel, imageModel };
    const serialized = serializePreferences(preferences);
    if (serialized === lastSavedPreferences.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      localStorage.setItem(localPreferencesKey, serialized);
      lastSavedPreferences.current = serialized;
      void putJson<PreferencesPayload>("/api/newsletter/preferences", {
        preferenceId,
        ...preferences,
      }).catch(() => {
        // Local preferences have already been saved; the API can retry on the next change.
      });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [copyModel, imageModel, preferenceId, preferencesLoaded, sources]);

  useEffect(() => {
    if (!copyModelSearch.trim() || filteredOpenRouterModels.length === 0) {
      return;
    }
    if (!filteredOpenRouterModels.some((model) => model.id === copyModel)) {
      setCopyModel(filteredOpenRouterModels[0].id);
    }
  }, [copyModel, copyModelSearch, filteredOpenRouterModels]);

  useEffect(() => {
    if (!imageModelSearch.trim() || filteredFalModels.length === 0) {
      return;
    }
    if (!filteredFalModels.some((model) => model.id === imageModel)) {
      setImageModel(filteredFalModels[0].id);
    }
  }, [filteredFalModels, imageModel, imageModelSearch]);

  async function loadModels() {
    setIsBusy(true);
    setStatus("Fetching OpenRouter and fal.ai model catalogs.");
    const payload = await fetchJson<ModelsPayload>("/api/newsletter/models");
    setOpenRouterModels(payload.openRouterModels);
    setFalModels(payload.falModels);
    setCopyModel((current) => current || payload.openRouterModels[0]?.id || "");
    setImageModel((current) => current || payload.falModels[0]?.id || "");
    setBalances(payload.balances);
    setStatus("Models are ready. Change the selections if you want, then click Gather news.");
    setIsBusy(false);
  }

  async function loadArticles() {
    setIsBusy(true);
    setStatus("Gathering and deduping newsletter sources.");
    const payload = await postJson<ArticlesPayload>("/api/newsletter/articles", { sources });
    setArticles(payload.articles);
    setSelectedArticleIds(new Set(payload.articles.slice(0, 30).map((article) => article.id)));
    setSources(payload.sources?.length ? payload.sources : sources);
    setBalances(payload.balances);
    setStatus(
      payload.error ??
        `Loaded ${payload.articles.length} deduped stories from ${payload.sourceCount} sources. Review the selected stories, then click Generate copy.`,
    );
    setIsBusy(false);
  }

  async function generateDraft(target?: string) {
    if (!canGenerateDraft && !target) {
      return;
    }

    setIsBusy(true);
    setStatus(target ? `Regenerating ${target}.` : "Generating newsletter copy with OpenRouter.");
    const payload = await postJson<DraftPayload>("/api/newsletter/draft", {
      model: copyModel,
      articles: selectedArticles,
      feedback: target ? sectionFeedback(target) || globalFeedback : globalFeedback,
      previousDraft: draft,
      target,
    });

    if (payload.error) {
      setStatus(payload.error);
    } else {
      setDraft(payload.draft);
      setStatus(
        payload.usedFallback
          ? "Draft created with local fallback. Review sections, then generate the image."
          : "Draft created. Review sections, then generate the image.",
      );
    }

    setBalances(payload.balances);
    setIsBusy(false);
  }

  async function generateImage() {
    if (!draft || !canGenerateImage) {
      return;
    }

    setIsBusy(true);
    setStatus("Generating hero image with fal.ai.");
    const payload = await postJson<ImagePayload>("/api/newsletter/image", {
      model: imageModel,
      prompt: draft.imagePrompt,
      feedback: imageFeedback,
    });

    if (payload.image) {
      setImage(payload.image);
      setStatus("Hero image generated.");
    } else {
      setStatus(payload.error ?? "Image generation failed.");
    }

    setBalances(payload.balances);
    setIsBusy(false);
  }

  async function populateMailchimpTemplate() {
    if (!draft || !image || !canPopulateMailchimp) {
      return;
    }

    setIsBusy(true);
    setStatus("Creating a Mailchimp draft campaign and populating the template.");

    const templateId = Number(mailchimpTemplateId);
    const payload = await postJson<MailchimpPayload>("/api/newsletter/mailchimp", {
      draft,
      image,
      templateId: Number.isFinite(templateId) && templateId > 0 ? templateId : undefined,
      sectionMap: mailchimpSectionMap,
    });

    if (payload.campaign) {
      setMailchimpCampaign(payload.campaign);
      setStatus(`Mailchimp draft created: ${payload.campaign.title}. Review it in Mailchimp before sending.`);
    } else {
      setStatus(payload.error ?? "Mailchimp template population failed.");
    }

    setIsBusy(false);
  }

  function toggleArticle(id: string) {
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addSource() {
    if (!sourceDraft.name.trim() || !sourceDraft.url.trim()) {
      setStatus("Source name and URL are required.");
      return;
    }

    const source = {
      ...sourceDraft,
      id: sourceDraft.id || crypto.randomUUID(),
      name: sourceDraft.name.trim(),
      url: sourceDraft.url.trim(),
      query: sourceDraft.query?.trim(),
      limit: Math.max(1, Math.min(Number(sourceDraft.limit) || 20, 100)),
    };
    setSources((current) => [source, ...current]);
    setSourceDraft(emptySourceDraft);
    setShowAddSource(false);
    setStatus(`Added source: ${source.name}.`);
  }

  function updateSource(sourceId: string, patch: Partial<NewsSource>) {
    setSources((current) => current.map((source) => (source.id === sourceId ? { ...source, ...patch } : source)));
  }

  function deleteSource(sourceId: string) {
    setSources((current) => current.filter((source) => source.id !== sourceId));
  }

  function resetSources() {
    const confirmed = typeof window === "undefined" || window.confirm("Replace your current sources with the defaults? Loaded articles will be cleared.");
    if (!confirmed) {
      return;
    }
    setSources(defaultNewsSources);
    setArticles([]);
    setSelectedArticleIds(new Set());
    setStatus("Restored default news sources.");
  }

  function toggleSourceExpanded(sourceId: string) {
    setExpandedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }

  function expandAllSources() {
    setExpandedSourceIds(new Set(sources.map((source) => source.id)));
  }

  function collapseAllSources() {
    setExpandedSourceIds(new Set());
  }

  function selectAllVisibleArticles() {
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      for (const article of visibleArticles) {
        next.add(article.id);
      }
      return next;
    });
  }

  function clearArticleSelection() {
    setSelectedArticleIds(new Set());
  }

  function selectTopArticles(count = 30) {
    setSelectedArticleIds(new Set(visibleArticles.slice(0, count).map((article) => article.id)));
  }

  function updateDraftField(field: "subject" | "preheader" | "intro" | "imagePrompt", value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateSection(sectionIndex: number, nextSection: NewsletterSection) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const sections = current.sections.map((section, index) => (index === sectionIndex ? nextSection : section));
      return { ...current, sections };
    });
  }

  function sectionFeedback(target: string) {
    if (!draft) {
      return "";
    }
    const section = draft.sections.find((candidate) => candidate.id === target);
    return section?.feedback ?? "";
  }

  function updateMailchimpSection(field: keyof MailchimpSectionMap, value: string) {
    setMailchimpSectionMap((current) => ({ ...current, [field]: value.trim() }));
  }

  return (
    <div className="newsletterApp">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Daily Newsletter</p>
          <h1>AI-news production workflow.</h1>
        </div>
        <div className="balanceBar">
          <BalancePill balance={balances.openRouter} />
          <BalancePill balance={balances.fal} />
        </div>
      </header>

      <section className="toolbar">
        <div className="modelControl">
          <label>
            Search copy models
            <input
              value={copyModelSearch}
              onChange={(event) => setCopyModelSearch(event.target.value)}
              placeholder="Model name or id"
            />
          </label>
          <label>
            Copy model
            <select value={copyModel} onChange={(event) => setCopyModel(event.target.value)}>
              {filteredOpenRouterModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <ModelCapabilities model={selectedCopyModel} emptyLabel="Load models to inspect copy capabilities." />
        </div>
        <div className="modelControl">
          <label>
            Search image models
            <input
              value={imageModelSearch}
              onChange={(event) => setImageModelSearch(event.target.value)}
              placeholder="Model name, id, or category"
            />
          </label>
          <label>
            Image model
            <select value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
              {filteredFalModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <ModelCapabilities model={selectedImageModel} emptyLabel="Load models to inspect image capabilities." />
        </div>
        <div className="toolbarActions">
          <button type="button" onClick={loadModels} disabled={isBusy}>
            Load models
          </button>
          <span>
            {openRouterModels.length + falModels.length > 0
              ? `${filteredOpenRouterModels.length}/${openRouterModels.length} copy, ${filteredFalModels.length}/${falModels.length} image`
              : "No model catalogs loaded"}
          </span>
        </div>
      </section>

      <p className="statusLine">{status}</p>
      <StepBar currentStep={currentStep} />

      <main className="workspace">
        <aside className="sourcePane">
          <div className="paneHeader">
            <h2>Source Queue</h2>
            <button type="button" onClick={loadArticles} disabled={isBusy || enabledSourceCount === 0}>
              Gather news
            </button>
          </div>
          <div className="paneMetrics">
            <span>
              <strong>{enabledSourceCount}</strong> of {totalSourceCount} sources active
            </span>
            <span>
              <strong>{selectedArticles.length}</strong> of {articles.length} articles selected
            </span>
          </div>

          <section className="sourceManager">
            <div className="sectionHeader">
              <h3>Sources</h3>
              <div className="sectionActions">
                <button
                  type="button"
                  className="ghost"
                  onClick={expandedSourceIds.size === sources.length ? collapseAllSources : expandAllSources}
                  aria-label={expandedSourceIds.size === sources.length ? "Collapse all sources" : "Expand all sources"}
                  title={expandedSourceIds.size === sources.length ? "Collapse all" : "Expand all"}
                >
                  {expandedSourceIds.size === sources.length ? "Collapse all" : "Expand all"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowAddSource((current) => !current)}
                  aria-expanded={showAddSource}
                >
                  {showAddSource ? "Cancel" : "+ Add"}
                </button>
                <button type="button" className="ghost" onClick={resetSources} title="Reset to defaults">
                  Reset
                </button>
              </div>
            </div>

            {showAddSource ? (
              <div className="sourceForm">
                <label className="fieldBlock compact">
                  Name
                  <input
                    value={sourceDraft.name}
                    onChange={(event) => setSourceDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="e.g. Hacker News"
                  />
                </label>
                <div className="sourceFormRow">
                  <label className="fieldBlock compact">
                    Type
                    <select
                      value={sourceDraft.type}
                      onChange={(event) =>
                        setSourceDraft((current) => ({ ...current, type: event.target.value as NewsSource["type"] }))
                      }
                    >
                      <option value="rss">RSS feed</option>
                      <option value="website">Website scrape</option>
                    </select>
                  </label>
                  <label className="fieldBlock compact">
                    Max items
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={sourceDraft.limit}
                      onChange={(event) => setSourceDraft((current) => ({ ...current, limit: Number(event.target.value) }))}
                    />
                  </label>
                </div>
                <label className="fieldBlock compact">
                  {sourceDraft.type === "rss" ? "Feed URL" : "Website URL"}
                  <input
                    value={sourceDraft.url}
                    onChange={(event) => setSourceDraft((current) => ({ ...current, url: event.target.value }))}
                    placeholder={sourceDraft.type === "rss" ? "https://example.com/rss.xml" : "https://example.com/news"}
                  />
                </label>
                <div className="sourceActions">
                  <button type="button" onClick={addSource}>
                    Add source
                  </button>
                </div>
              </div>
            ) : null}

            <div className="sourceList">
              {sources.map((source) => {
                const isExpanded = expandedSourceIds.has(source.id);
                const panelId = `source-panel-${source.id}`;
                return (
                  <div
                    className={`sourceCard ${source.enabled ? "" : "disabled"} ${isExpanded ? "expanded" : "collapsed"}`}
                    key={source.id}
                  >
                    <div className="sourceCardTop">
                      <label className="toggleWrap" title={source.enabled ? "Disable source" : "Enable source"}>
                        <input
                          type="checkbox"
                          className="toggleSwitch"
                          checked={source.enabled}
                          onChange={(event) => updateSource(source.id, { enabled: event.target.checked })}
                        />
                        <span className="sr-only">{source.enabled ? "Enabled" : "Disabled"}</span>
                      </label>
                      <button
                        type="button"
                        className="sourceSummary"
                        onClick={() => toggleSourceExpanded(source.id)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                      >
                        <span className={`chevron ${isExpanded ? "open" : ""}`} aria-hidden="true">
                          ▸
                        </span>
                        <span className="sourceSummaryName">{source.name || "Untitled source"}</span>
                        <span className="sourceSummaryMeta">
                          {source.type === "rss" ? "RSS" : "Web"} · {source.limit}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="iconButton ghost danger"
                        onClick={() => deleteSource(source.id)}
                        aria-label={`Delete ${source.name}`}
                      >
                        ×
                      </button>
                    </div>
                    {isExpanded ? (
                      <div id={panelId} className="sourceCardBody">
                        <label className="fieldBlock compact">
                          Name
                          <input
                            value={source.name}
                            onChange={(event) => updateSource(source.id, { name: event.target.value })}
                            aria-label={`${source.name} name`}
                          />
                        </label>
                        <div className="sourceCardBottom">
                          <label className="fieldBlock compact">
                            Type
                            <select
                              value={source.type}
                              onChange={(event) =>
                                updateSource(source.id, { type: event.target.value as NewsSource["type"] })
                              }
                              aria-label={`${source.name} type`}
                            >
                              <option value="rss">RSS feed</option>
                              <option value="website">Website scrape</option>
                            </select>
                          </label>
                          <label className="fieldBlock compact">
                            Max items
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={source.limit}
                              onChange={(event) => updateSource(source.id, { limit: Number(event.target.value) })}
                              aria-label={`${source.name} limit`}
                            />
                          </label>
                        </div>
                        <label className="fieldBlock compact">
                          {source.type === "rss" ? "Feed URL" : "Website URL"}
                          <input
                            className="sourceUrl"
                            value={source.url}
                            onChange={(event) => updateSource(source.id, { url: event.target.value })}
                            aria-label={`${source.name} URL`}
                            title={source.url}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="articleSection">
            <div className="sectionHeader">
              <h3>
                Articles{articles.length > 0 ? <span className="count"> ({visibleArticles.length})</span> : null}
              </h3>
              {articles.length > 0 ? (
                <select
                  className="articleFilter"
                  value={articleSourceFilter}
                  onChange={(event) => setArticleSourceFilter(event.target.value)}
                  aria-label="Filter articles by source"
                >
                  <option value="all">All sources</option>
                  {articleSourceNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {articles.length > 0 ? (
              <div className="articleToolbar">
                <button type="button" className="ghost" onClick={selectAllVisibleArticles}>
                  Select all
                </button>
                <button type="button" className="ghost" onClick={() => selectTopArticles(30)}>
                  Top 30
                </button>
                <button type="button" className="ghost" onClick={clearArticleSelection}>
                  Clear
                </button>
              </div>
            ) : null}

            <div className="articleList">
              {articles.length === 0 ? (
                <div className="hintBox">
                  <span>Click</span>
                  <strong className="nowrap">Gather news</strong>
                  <span>to load stories.</span>
                </div>
              ) : visibleArticles.length === 0 ? (
                <div className="hintBox">No articles match this filter.</div>
              ) : (
                visibleArticles.map((article) => (
                  <label className="articleRow" key={article.id}>
                    <input
                      type="checkbox"
                      checked={selectedArticleIds.has(article.id)}
                      onChange={() => toggleArticle(article.id)}
                    />
                    <span className="articleBody">
                      <strong>{article.title}</strong>
                      <span className="articleMeta">
                        <span className="sourcePill">{article.source}</span>
                        {article.published ? (
                          <span className="articleDate" title={article.published}>
                            {formatRelativeDate(article.published)}
                          </span>
                        ) : null}
                        <span className="scoreBadge" title="Relevance score">
                          {article.score}
                        </span>
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="editorPane">
          <div className="paneHeader">
            <h2>Draft Review</h2>
            <button type="button" onClick={() => generateDraft()} disabled={!canGenerateDraft}>
              Generate copy
            </button>
          </div>

          <label className="fieldBlock">
            Whole-newsletter feedback
            <textarea
              value={globalFeedback}
              onChange={(event) => setGlobalFeedback(event.target.value)}
              placeholder="Ask for a different angle, tone, ordering, or story selection."
            />
          </label>

          {draft ? (
            <>
              <DraftTextField label="Subject" value={draft.subject} onChange={(value) => updateDraftField("subject", value)} />
              <DraftTextField
                label="Preheader"
                value={draft.preheader}
                onChange={(value) => updateDraftField("preheader", value)}
              />
              <DraftTextField label="Intro" value={draft.intro} onChange={(value) => updateDraftField("intro", value)} multiline />

              <div className="sectionStack">
                {draft.sections.map((section, sectionIndex) => (
                  <article className="sectionEditor" key={section.id}>
                    <div className="sectionTopline">
                      <input
                        className="sectionHeading"
                        value={section.heading}
                        onChange={(event) => updateSection(sectionIndex, { ...section, heading: event.target.value })}
                      />
                    </div>
                    <textarea
                      value={section.summary}
                      onChange={(event) => updateSection(sectionIndex, { ...section, summary: event.target.value })}
                    />
                    {section.items.map((item) => (
                      <div className="storyItem" key={`${section.id}-${item.url}`}>
                        <strong>{item.title}</strong>
                        <span>{item.summary}</span>
                        <small>{item.whyItMatters}</small>
                      </div>
                    ))}
                    <label className="fieldBlock compact">
                      Section feedback
                      <textarea
                        value={section.feedback ?? ""}
                        onChange={(event) => updateSection(sectionIndex, { ...section, feedback: event.target.value })}
                      />
                    </label>
                    <button type="button" onClick={() => generateDraft(section.id)} disabled={isBusy}>
                      Regenerate section
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="emptyState">
              {articles.length === 0
                ? "Gather news before generating copy."
                : "Review selected stories, then click Generate copy."}
            </div>
          )}
        </section>

        <aside className="publishPane">
          <div className="paneHeader">
            <h2>Hero Image</h2>
            <button type="button" onClick={generateImage} disabled={!canGenerateImage}>
              Generate image
            </button>
          </div>

          {draft ? (
            <label className="fieldBlock">
              Image prompt
              <textarea value={draft.imagePrompt} onChange={(event) => updateDraftField("imagePrompt", event.target.value)} />
            </label>
          ) : null}

          <label className="fieldBlock">
            Image feedback
            <textarea
              value={imageFeedback}
              onChange={(event) => setImageFeedback(event.target.value)}
              placeholder="Change composition, palette, style, realism, or mood."
            />
          </label>

          <div className="imagePreview">
            {image ? <img src={image.url} alt="Generated newsletter hero" /> : <span>No hero image yet.</span>}
          </div>

          <section className="mailchimpPanel">
            <div className="sectionHeader">
              <h3>Mailchimp Template</h3>
            </div>
            <label className="fieldBlock compact">
              Template ID
              <input
                value={mailchimpTemplateId}
                onChange={(event) => setMailchimpTemplateId(event.target.value)}
                placeholder="Uses MAILCHIMP_TEMPLATE_ID if blank"
                inputMode="numeric"
              />
            </label>
            <div className="mailchimpSectionGrid">
              <label className="fieldBlock compact">
                Preheader
                <input
                  value={mailchimpSectionMap.preheader ?? ""}
                  onChange={(event) => updateMailchimpSection("preheader", event.target.value)}
                  placeholder="preheader"
                />
              </label>
              <label className="fieldBlock compact">
                Intro
                <input
                  value={mailchimpSectionMap.intro}
                  onChange={(event) => updateMailchimpSection("intro", event.target.value)}
                  placeholder="intro"
                />
              </label>
              <label className="fieldBlock compact">
                Hero image
                <input
                  value={mailchimpSectionMap.heroImage}
                  onChange={(event) => updateMailchimpSection("heroImage", event.target.value)}
                  placeholder="hero_image"
                />
              </label>
              <label className="fieldBlock compact">
                Body
                <input
                  value={mailchimpSectionMap.body}
                  onChange={(event) => updateMailchimpSection("body", event.target.value)}
                  placeholder="body"
                />
              </label>
            </div>
            <button type="button" onClick={populateMailchimpTemplate} disabled={!canPopulateMailchimp}>
              Populate Mailchimp
            </button>
            {mailchimpCampaign ? (
              <div className="mailchimpResult">
                <strong>{mailchimpCampaign.title}</strong>
                <span>Campaign ID: {mailchimpCampaign.id}</span>
                {mailchimpCampaign.archiveUrl ? (
                  <a href={mailchimpCampaign.archiveUrl} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="hintBox compact">Generate copy and image before populating Mailchimp.</div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function StepBar({ currentStep }: { currentStep: number }) {
  const steps = ["Models", "News", "Copy", "Image", "Mailchimp"];

  return (
    <ol className="stepBar">
      {steps.map((step, index) => (
        <li key={step} className={index <= currentStep ? "active" : ""}>
          <span>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function getCurrentStep(input: {
  modelsLoaded: boolean;
  articlesLoaded: boolean;
  draftReady: boolean;
  imageReady: boolean;
  mailchimpReady: boolean;
}) {
  if (input.mailchimpReady) {
    return 4;
  }
  if (input.imageReady) {
    return 3;
  }
  if (input.draftReady) {
    return 2;
  }
  if (input.articlesLoaded) {
    return 1;
  }
  if (input.modelsLoaded) {
    return 0;
  }
  return -1;
}

function BalancePill({ balance }: { balance: ProviderBalance }) {
  const amount = formatBalance(balance);
  return (
    <div className={`balancePill ${balance.status}`} title={balance.details ?? balance.status}>
      <span>{balance.label}</span>
      <strong>{amount}</strong>
      <small>{balance.status}</small>
    </div>
  );
}

function ModelCapabilities({ model, emptyLabel }: { model: ProviderModel | null; emptyLabel: string }) {
  if (!model) {
    return <div className="modelCapabilities empty">{emptyLabel}</div>;
  }

  return (
    <div className="modelCapabilities">
      <div className="modelCapabilityHeader">
        <strong>{model.name}</strong>
        <code>{model.id}</code>
      </div>
      <dl>
        {model.category ? (
          <>
            <dt>Category</dt>
            <dd>{model.category}</dd>
          </>
        ) : null}
        {model.contextLength ? (
          <>
            <dt>Context</dt>
            <dd>{model.contextLength.toLocaleString()} tokens</dd>
          </>
        ) : null}
        {model.pricing ? (
          <>
            <dt>Pricing</dt>
            <dd>{model.pricing}</dd>
          </>
        ) : null}
        {model.description ? (
          <>
            <dt>Description</dt>
            <dd>{model.description}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

function formatBalance(balance: ProviderBalance) {
  if (balance.balance !== null) {
    return `${balance.currency} ${balance.balance.toFixed(4)}`;
  }
  if (balance.status === "error") {
    return "Auth error";
  }
  if (balance.status === "missing_key") {
    return "Missing key";
  }
  if (balance.provider === "fal" && balance.status === "unavailable") {
    return "Billing unavailable";
  }
  return "Unavailable";
}

function DraftTextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  return (
    <label className="fieldBlock">
      {label}
      {multiline ? <textarea value={value} onChange={handleChange} /> : <input value={value} onChange={handleChange} />}
    </label>
  );
}

function formatRelativeDate(iso: string) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return "";
  }
  const deltaMs = Date.now() - time;
  const minutes = Math.round(deltaMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(time).toLocaleDateString();
}

function filterModels(models: ProviderModel[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return models;
  }

  return models.filter((model) => normalizeSearchText(modelSearchText(model)).includes(normalizedQuery));
}

function modelSearchText(model: ProviderModel) {
  return [model.id, model.name, model.category]
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function getOrCreatePreferenceId() {
  const existing = localStorage.getItem(preferenceIdKey);
  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  localStorage.setItem(preferenceIdKey, next);
  return next;
}

function loadLocalPreferences(): NewsletterPreferences | null {
  try {
    const raw = localStorage.getItem(localPreferencesKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<NewsletterPreferences>;
    if (!Array.isArray(parsed.sources)) {
      return null;
    }

    return {
      preferenceId: typeof parsed.preferenceId === "string" ? parsed.preferenceId : "",
      sources: parsed.sources,
      copyModel: typeof parsed.copyModel === "string" ? parsed.copyModel : "",
      imageModel: typeof parsed.imageModel === "string" ? parsed.imageModel : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function normalizeDashboardSources(sources: NewsSource[]): NewsSource[] {
  return sources.map((source) => {
    const rawType = (source as NewsSource & { type?: string }).type;
    const type: NewsSource["type"] = rawType === "rss" ? "rss" : "website";
    return {
      ...source,
      type,
      query: undefined,
    };
  });
}

function serializePreferences(input: { sources: NewsSource[]; copyModel: string; imageModel: string }) {
  return JSON.stringify({
    sources: normalizeDashboardSources(input.sources),
    copyModel: input.copyModel,
    imageModel: input.imageModel,
  });
}
