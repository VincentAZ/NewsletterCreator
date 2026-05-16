"use client";

import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Article,
  Balances,
  GeneratedImage,
  MailchimpCampaignDraft,
  NewsSource,
  NewsletterPreferences,
  NewsletterDraft,
  NewsletterSection,
  PromptSet,
  ProviderBalance,
  ProviderModel,
  ValidationResult,
} from "@/lib/newsletter/types";
import {
  createDefaultPromptSet,
  defaultCopySystemPrompt,
  defaultCopyTaskPrompt,
  defaultImageTaskPrompt,
  defaultImageSystemPrompt,
  defaultScrapeSystemPrompt,
  defaultScrapeTaskPrompt,
} from "@/lib/newsletter/prompts";

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
const defaultPreferenceId = "default-preferences";
const defaultScrapeModel = "openai/gpt-4.1-mini";

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

const helpText = {
  models:
    "Click Load models to populate the copy, AI scrape, and image model selectors. The selected models are saved as preferences.",
  sourceQueue:
    "Click Load models first to choose an AI scrape model, then click Gather news to fetch and dedupe articles from active sources.",
  sources:
    "Add RSS feeds or website pages, expand a source to edit its URL and limit, or reset the list back to defaults.",
  addSource:
    "Name the source, choose RSS feed or website scrape, set the max item count, enter the URL, then click Add source.",
  sourceCard:
    "Use the switch to include this source, open the row to edit details, or delete it from the queue.",
  articles:
    "Select the stories to include in the draft. Use the filter and quick selection buttons to control what the copy model sees.",
  draft:
    "Click Generate copy after selecting articles. Edit subject, preheader, intro, section text, and feedback before regenerating any part.",
  draftSection:
    "Edit the section heading and summary, review the included stories, add section feedback, then regenerate only this section if needed.",
  heroImage:
    "After copy is generated, edit the image prompt or feedback, choose an image model, then click Generate image.",
  mailchimp:
    "Creates a draft campaign in the single Mailchimp template configured in .env after copy and image are ready.",
};

export function NewsletterDashboard() {
  const [openRouterModels, setOpenRouterModels] = useState<ProviderModel[]>([]);
  const [falModels, setFalModels] = useState<ProviderModel[]>([]);
  const [sources, setSources] = useState<NewsSource[]>(defaultNewsSources);
  const [sourceDraft, setSourceDraft] = useState<NewsSource>(emptySourceDraft);
  const [showAddSource, setShowAddSource] = useState(false);
  const [copyModel, setCopyModel] = useState("");
  const [scrapeModel, setScrapeModel] = useState(defaultScrapeModel);
  const [imageModel, setImageModel] = useState("");
  const [copyModelSearch, setCopyModelSearch] = useState("");
  const [scrapeModelSearch, setScrapeModelSearch] = useState("");
  const [imageModelSearch, setImageModelSearch] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [articleSourceFilter, setArticleSourceFilter] = useState<string>("all");
  const [expandedSourceIds, setExpandedSourceIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<NewsletterDraft | null>(null);
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [balances, setBalances] = useState<Balances>(emptyBalances);
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [scrapeSystemPrompt, setScrapeSystemPrompt] = useState(defaultScrapeSystemPrompt);
  const [scrapeTaskPrompt, setScrapeTaskPrompt] = useState(defaultScrapeTaskPrompt);
  const [imageFeedback, setImageFeedback] = useState("");
  const [copySystemPrompt, setCopySystemPrompt] = useState(defaultCopySystemPrompt);
  const [copyTaskPrompt, setCopyTaskPrompt] = useState(defaultCopyTaskPrompt);
  const [imageSystemPrompt, setImageSystemPrompt] = useState(defaultImageSystemPrompt);
  const [imageTaskPrompt, setImageTaskPrompt] = useState(defaultImageTaskPrompt);
  const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
  const [selectedPromptSetId, setSelectedPromptSetId] = useState("");
  const [promptSetName, setPromptSetName] = useState("Default workflow prompts");
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
  const filteredScrapeModels = useMemo(() => {
    return filterModels(openRouterModels, scrapeModelSearch);
  }, [openRouterModels, scrapeModelSearch]);
  const filteredFalModels = useMemo(() => {
    return filterModels(falModels, imageModelSearch);
  }, [falModels, imageModelSearch]);
  const selectedCopyModel = useMemo(() => {
    return openRouterModels.find((model) => model.id === copyModel) ?? null;
  }, [copyModel, openRouterModels]);
  const selectedScrapeModel = useMemo(() => {
    return openRouterModels.find((model) => model.id === scrapeModel) ?? null;
  }, [openRouterModels, scrapeModel]);
  const selectedImageModel = useMemo(() => {
    return falModels.find((model) => model.id === imageModel) ?? null;
  }, [falModels, imageModel]);

  const canGatherNews = openRouterModels.length > 0 && Boolean(scrapeModel) && enabledSourceCount > 0 && !isBusy;
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
      const { preferenceId: id, legacyPreferenceId } = getPreferenceIdentity();
      setPreferenceId(id);

      const preferencesPayload = await fetchJson<PreferencesPayload>(
        `/api/newsletter/preferences?preferenceId=${encodeURIComponent(id)}`,
      );
      let preferences = preferencesPayload.configured ? preferencesPayload.preferences : null;
      let shouldMigrateLegacyPreferences = false;

      if (!preferences && preferencesPayload.configured && legacyPreferenceId && legacyPreferenceId !== id) {
        const legacyPayload = await fetchJson<PreferencesPayload>(
          `/api/newsletter/preferences?preferenceId=${encodeURIComponent(legacyPreferenceId)}`,
        );
        if (legacyPayload.configured && legacyPayload.preferences) {
          preferences = legacyPayload.preferences;
          shouldMigrateLegacyPreferences = true;
        }
      }

      if (preferences?.sources.length) {
        setSources(normalizeDashboardSources(preferences.sources));
      }
      if (preferences?.copyModel) {
        setCopyModel(preferences.copyModel);
      }
      if (preferences?.scrapeModel) {
        setScrapeModel(preferences.scrapeModel);
      }
      if (preferences?.imageModel) {
        setImageModel(preferences.imageModel);
      }
      const savedPromptSets = normalizeDashboardPromptSets(preferences?.promptSets ?? []);
      const lastPromptSet = findPromptSet(savedPromptSets, preferences?.lastPromptSetId) ?? savedPromptSets[0] ?? null;
      setPromptSets(savedPromptSets);
      if (lastPromptSet) {
        applyPromptSetState(lastPromptSet, {
          setSelectedPromptSetId,
          setPromptSetName,
          setScrapeSystemPrompt,
          setScrapeTaskPrompt,
          setCopySystemPrompt,
          setCopyTaskPrompt,
          setImageSystemPrompt,
          setImageTaskPrompt,
        });
      }
      lastSavedPreferences.current = preferences && !shouldMigrateLegacyPreferences
        ? serializePreferences({
            sources: preferences.sources.length ? preferences.sources : defaultNewsSources,
            copyModel: preferences.copyModel ?? "",
            scrapeModel: preferences.scrapeModel ?? "",
            imageModel: preferences.imageModel ?? "",
            promptSets: savedPromptSets,
            lastPromptSetId: lastPromptSet?.id ?? preferences.lastPromptSetId ?? "",
          })
        : "";

      const payload = await fetchJson<{ balances: Balances }>("/api/newsletter/balances");
      if (isMounted) {
        setBalances(payload.balances);
        setPreferencesLoaded(true);
        if (!preferencesPayload.configured) {
          setStatus("Supabase is required to persist dashboard preferences. Add Supabase env vars and run the schema script.");
        } else if (preferencesPayload.error) {
          setStatus(preferencesPayload.error);
        }
      }
    }

    void loadInitialState().catch(() => {
      if (isMounted) {
        setPreferencesLoaded(true);
        setStatus("Database preferences failed to load. Check Supabase configuration and schema.");
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

    const preferences = {
      sources,
      copyModel,
      scrapeModel,
      imageModel,
      promptSets,
      lastPromptSetId: selectedPromptSetId,
    };
    const serialized = serializePreferences(preferences);
    if (serialized === lastSavedPreferences.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void putJson<PreferencesPayload>("/api/newsletter/preferences", {
        preferenceId,
        ...preferences,
      })
        .then((payload) => {
          if (!payload.configured) {
            setStatus("Supabase is required to persist dashboard preferences. Add Supabase env vars and run the schema script.");
            return;
          }
          if (payload.error) {
            setStatus(payload.error);
            return;
          }
          lastSavedPreferences.current = serialized;
        })
        .catch(() => {
          setStatus("Database preferences failed to save. Check Supabase configuration and schema.");
        });
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [copyModel, imageModel, preferenceId, preferencesLoaded, promptSets, scrapeModel, selectedPromptSetId, sources]);

  async function loadModels() {
    setIsBusy(true);
    setStatus("Fetching OpenRouter and fal.ai model catalogs.");
    try {
      const id = preferenceId || getPreferenceIdentity().preferenceId;
      if (!preferenceId) {
        setPreferenceId(id);
      }

      const [payload, preferencesPayload] = await Promise.all([
        fetchJson<ModelsPayload>("/api/newsletter/models"),
        fetchJson<PreferencesPayload>(`/api/newsletter/preferences?preferenceId=${encodeURIComponent(id)}`).catch(
          () => null,
        ),
      ]);
      const savedScrapeModel = preferencesPayload?.configured ? preferencesPayload.preferences?.scrapeModel.trim() : "";

      setOpenRouterModels(payload.openRouterModels);
      setFalModels(payload.falModels);
      setCopyModel((current) => current || payload.openRouterModels[0]?.id || "");
      setScrapeModel((current) => savedScrapeModel || current || payload.openRouterModels[0]?.id || defaultScrapeModel);
      setImageModel((current) => current || payload.falModels[0]?.id || "");
      setBalances(payload.balances);
      setStatus(
        savedScrapeModel
          ? "Models are ready. Loaded your saved AI scrape model preference."
          : "Models are ready. Change the selections if you want, then click Gather news.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? `Model loading failed: ${error.message}` : "Model loading failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function loadArticles() {
    if (!canGatherNews) {
      setStatus("Click Load models and choose an AI scrape model before gathering news.");
      return;
    }

    setIsBusy(true);
    setStatus("Gathering and deduping newsletter sources.");
    const payload = await postJson<ArticlesPayload>("/api/newsletter/articles", {
      sources,
      scrapeModel,
      scrapeSystemPrompt,
      scrapeTaskPrompt,
    });
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
      systemPrompt: copySystemPrompt,
      taskPrompt: copyTaskPrompt,
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
    try {
      setStatus("Generating hero image with fal.ai.");
      const payload = await postJson<ImagePayload>("/api/newsletter/image", {
        model: imageModel,
        prompt: draft.imagePrompt,
        feedback: imageFeedback,
        systemPrompt: imageSystemPrompt,
        taskPrompt: imageTaskPrompt,
      });

      if (payload.image) {
        setImage(payload.image);
        setStatus("Hero image generated.");
      } else {
        setStatus(payload.error ?? "Image generation failed.");
      }

      setBalances(payload.balances);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function populateMailchimpTemplate() {
    if (!draft || !image || !canPopulateMailchimp) {
      setStatus("Generate copy and image before populating Mailchimp.");
      return;
    }

    setIsBusy(true);
    try {
      setStatus("Creating a Mailchimp draft campaign and populating the template.");

      const payload = await postJson<MailchimpPayload>("/api/newsletter/mailchimp", {
        draft,
        image,
      });

      if (payload.campaign) {
        setMailchimpCampaign(payload.campaign);
        const checklist = payload.campaign.checklist?.length ? ` Mailchimp still reports: ${payload.campaign.checklist.join(" ")}` : "";
        setStatus(`Mailchimp draft created: ${payload.campaign.title}. Review it in Mailchimp before sending.${checklist}`);
      } else {
        setStatus(payload.error ?? "Mailchimp template population failed.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Mailchimp template population failed.");
    } finally {
      setIsBusy(false);
    }
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

  function deleteSection(sectionIndex: number) {
    setDraft((current) => {
      if (!current || current.sections.length <= 1) {
        return current;
      }
      const sections = current.sections.filter((_, index) => index !== sectionIndex);
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

  async function savePromptSet() {
    const promptSet = buildCurrentPromptSet({
      id: selectedPromptSetId || crypto.randomUUID(),
      name: promptSetName,
      scrapeSystemPrompt,
      scrapeTaskPrompt,
      copySystemPrompt,
      copyTaskPrompt,
      imageSystemPrompt,
      imageTaskPrompt,
    });
    const nextPromptSets = upsertPromptSet(promptSets, promptSet);

    setPromptSets(nextPromptSets);
    setSelectedPromptSetId(promptSet.id);
    setPromptSetName(promptSet.name);
    setStatus("Saving prompt set.");

    try {
      await persistPreferencesNow({
        promptSets: nextPromptSets,
        lastPromptSetId: promptSet.id,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Prompt set save failed.");
    }
  }

  function newPromptSet() {
    const promptSet = createDefaultPromptSet();
    setSelectedPromptSetId("");
    setPromptSetName(promptSet.name);
    setScrapeSystemPrompt(promptSet.scrapeSystemPrompt);
    setScrapeTaskPrompt(promptSet.scrapeTaskPrompt);
    setCopySystemPrompt(promptSet.copySystemPrompt);
    setCopyTaskPrompt(promptSet.copyTaskPrompt);
    setImageSystemPrompt(promptSet.imageSystemPrompt);
    setImageTaskPrompt(promptSet.imageTaskPrompt);
    setStatus("Started a new unsaved prompt set.");
  }

  function selectPromptSet(promptSetId: string) {
    const promptSet = findPromptSet(promptSets, promptSetId);
    if (!promptSet) {
      setSelectedPromptSetId("");
      return;
    }

    applyPromptSetState(promptSet, {
      setSelectedPromptSetId,
      setPromptSetName,
      setScrapeSystemPrompt,
      setScrapeTaskPrompt,
      setCopySystemPrompt,
      setCopyTaskPrompt,
      setImageSystemPrompt,
      setImageTaskPrompt,
    });
    setStatus(`Loaded prompt set: ${promptSet.name}.`);
    void persistPreferencesNow({ lastPromptSetId: promptSet.id }).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Last used prompt save failed.");
    });
  }

  async function persistPreferencesNow(overrides: Partial<{
    sources: NewsSource[];
    copyModel: string;
    scrapeModel: string;
    imageModel: string;
    promptSets: PromptSet[];
    lastPromptSetId: string;
  }>) {
    const id = preferenceId || getPreferenceIdentity().preferenceId;
    if (!preferenceId) {
      setPreferenceId(id);
    }
    const preferences = {
      sources,
      copyModel,
      scrapeModel,
      imageModel,
      promptSets,
      lastPromptSetId: selectedPromptSetId,
      ...overrides,
    };
    const payload = await putJson<PreferencesPayload>("/api/newsletter/preferences", {
      preferenceId: id,
      ...preferences,
    });

    if (!payload.configured) {
      setStatus("Supabase is required to save prompts. Add Supabase env vars and run the schema script.");
      return;
    }
    if (payload.error) {
      setStatus(payload.error);
      return;
    }

    lastSavedPreferences.current = serializePreferences(preferences);
    setStatus("Prompt set saved.");
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
        <div className="toolbarIntro">
          <div>
            <h2>Models</h2>
            <span>Copy and image setup</span>
          </div>
          <HelpButton label="Models help">{helpText.models}</HelpButton>
        </div>
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
              {copyModel && !filteredOpenRouterModels.some((model) => model.id === copyModel) ? (
                <option value={copyModel}>{selectedCopyModel?.name ?? copyModel}</option>
              ) : null}
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
              {imageModel && !filteredFalModels.some((model) => model.id === imageModel) ? (
                <option value={imageModel}>{selectedImageModel?.name ?? imageModel}</option>
              ) : null}
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
            <div className="headerTitle">
              <h2>Source Queue</h2>
              <HelpButton label="Source queue help">{helpText.sourceQueue}</HelpButton>
            </div>
            <button type="button" onClick={loadArticles} disabled={!canGatherNews}>
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

          <div className={`scrapeSettings ${openRouterModels.length > 0 ? "loaded" : ""}`}>
            <div className="modelControl">
              <label>
                Search scrape models
                <input
                  value={scrapeModelSearch}
                  onChange={(event) => setScrapeModelSearch(event.target.value)}
                  placeholder="Model name or id"
                  disabled={openRouterModels.length === 0}
                />
              </label>
              <div className="modelOptionField">
                <span className="modelOptionLabel">AI scrape model</span>
                <ModelSelect
                  models={filteredScrapeModels}
                  selectedId={openRouterModels.length > 0 ? scrapeModel : ""}
                  onSelect={setScrapeModel}
                  disabled={openRouterModels.length === 0}
                  selectedModel={selectedScrapeModel}
                  emptyLabel={
                    openRouterModels.length === 0
                      ? "Load models first"
                      : "No scrape models match this search."
                  }
                />
              </div>
              <ModelCapabilities model={selectedScrapeModel} emptyLabel="Load models to inspect scrape capabilities." />
              <span className="fieldHint">
                {openRouterModels.length > 0
                  ? `${filteredScrapeModels.length}/${openRouterModels.length} OpenRouter scrape models shown. Your choice is saved.`
                  : "Click Load models to choose the OpenRouter model used for AI website scraping."}
              </span>
            </div>
            <label className="fieldBlock compact">
              AI scrape system prompt
              <textarea
                className="systemPromptInput"
                value={scrapeSystemPrompt}
                onChange={(event) => setScrapeSystemPrompt(event.target.value)}
                placeholder={defaultScrapeSystemPrompt}
              />
            </label>
            <label className="fieldBlock compact">
              AI scrape task prompt
              <textarea
                className="systemPromptInput large"
                value={scrapeTaskPrompt}
                onChange={(event) => setScrapeTaskPrompt(event.target.value)}
                placeholder={defaultScrapeTaskPrompt}
              />
            </label>
          </div>

          <section className="sourceManager">
            <div className="sectionHeader">
              <div className="sectionTitle">
                <h3>Sources</h3>
                <HelpButton label="Sources help">{helpText.sources}</HelpButton>
              </div>
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
                <div className="formHeader">
                  <strong>Add Source</strong>
                  <HelpButton label="Add source help">{helpText.addSource}</HelpButton>
                </div>
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
                      <HelpButton label={`${source.name || "Source"} help`}>{helpText.sourceCard}</HelpButton>
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
              <div className="sectionTitle">
                <h3>
                  Articles{articles.length > 0 ? <span className="count"> ({visibleArticles.length})</span> : null}
                </h3>
                <HelpButton label="Articles help">{helpText.articles}</HelpButton>
              </div>
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
            <div className="headerTitle">
              <h2>Draft Review</h2>
              <HelpButton label="Draft review help">{helpText.draft}</HelpButton>
            </div>
            <button type="button" onClick={() => generateDraft()} disabled={!canGenerateDraft}>
              Generate copy
            </button>
          </div>

          <div className="promptLibrary">
            <label>
              Saved prompts
              <select value={selectedPromptSetId} onChange={(event) => selectPromptSet(event.target.value)}>
                <option value="">{promptSets.length > 0 ? "Unsaved prompt set" : "No saved prompt sets"}</option>
                {promptSets.map((promptSet) => (
                  <option key={promptSet.id} value={promptSet.id}>
                    {promptSet.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prompt name
              <input value={promptSetName} onChange={(event) => setPromptSetName(event.target.value)} />
            </label>
            <div className="promptLibraryActions">
              <button type="button" onClick={() => void savePromptSet()} disabled={isBusy}>
                Save prompt
              </button>
              <button type="button" className="ghost" onClick={newPromptSet} disabled={isBusy}>
                New prompt
              </button>
            </div>
          </div>

          <label className="fieldBlock">
            Copy system prompt
            <textarea
              className="systemPromptInput"
              value={copySystemPrompt}
              onChange={(event) => setCopySystemPrompt(event.target.value)}
              placeholder={defaultCopySystemPrompt}
            />
          </label>

          <label className="fieldBlock">
            Copy task prompt
            <textarea
              className="systemPromptInput large"
              value={copyTaskPrompt}
              onChange={(event) => setCopyTaskPrompt(event.target.value)}
              placeholder={defaultCopyTaskPrompt}
            />
          </label>

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
                      <HelpButton label={`${section.heading || "Draft section"} help`}>{helpText.draftSection}</HelpButton>
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
                    <div className="sectionControls">
                      <button type="button" onClick={() => generateDraft(section.id)} disabled={isBusy}>
                        Regenerate section
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => deleteSection(sectionIndex)}
                        disabled={isBusy || draft.sections.length <= 1}
                        title={draft.sections.length <= 1 ? "Keep at least one section" : `Delete ${section.heading || "section"}`}
                      >
                        Delete section
                      </button>
                    </div>
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
            <div className="headerTitle">
              <h2>Hero Image</h2>
              <HelpButton label="Hero image help">{helpText.heroImage}</HelpButton>
            </div>
            <button type="button" onClick={generateImage} disabled={!canGenerateImage}>
              Generate image
            </button>
          </div>

          <label className="fieldBlock">
            Image system prompt
            <textarea
              className="systemPromptInput"
              value={imageSystemPrompt}
              onChange={(event) => setImageSystemPrompt(event.target.value)}
              placeholder={defaultImageSystemPrompt}
            />
          </label>

          <label className="fieldBlock">
            Image task prompt
            <textarea
              className="systemPromptInput large"
              value={imageTaskPrompt}
              onChange={(event) => setImageTaskPrompt(event.target.value)}
              placeholder={defaultImageTaskPrompt}
            />
          </label>

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
              <div className="sectionTitle">
                <h3>Mailchimp Template</h3>
                <HelpButton label="Mailchimp template help">{helpText.mailchimp}</HelpButton>
              </div>
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

function HelpButton({ label, children }: { label: string; children: string }) {
  const tooltipId = useId();

  return (
    <span className="helpControl">
      <button type="button" className="helpButton" aria-label={label} aria-describedby={tooltipId} title={children}>
        ?
      </button>
      <span id={tooltipId} role="tooltip" className="helpTooltip">
        {children}
      </span>
    </span>
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

function ModelSelect({
  models,
  selectedId,
  onSelect,
  disabled,
  selectedModel,
  emptyLabel,
}: {
  models: ProviderModel[];
  selectedId: string;
  onSelect: (modelId: string) => void;
  disabled: boolean;
  selectedModel: ProviderModel | null;
  emptyLabel: string;
}) {
  const hasSelectedOption = selectedId && models.some((model) => model.id === selectedId);

  return (
    <select
      value={selectedId}
      onChange={(event) => onSelect(event.target.value)}
      disabled={disabled}
      aria-label="AI scrape model"
    >
      {disabled || models.length === 0 ? <option value="">{emptyLabel}</option> : null}
      {selectedId && !hasSelectedOption ? (
        <option value={selectedId}>{selectedModel?.name ?? selectedId}</option>
      ) : null}
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
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
  return parseJsonResponse<T>(response);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(response);
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJsonResponse<T>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }
  return payload as T;
}

function getPreferenceIdentity() {
  const existing = localStorage.getItem(preferenceIdKey);
  if (existing !== defaultPreferenceId) {
    localStorage.setItem(preferenceIdKey, defaultPreferenceId);
  }
  return {
    preferenceId: defaultPreferenceId,
    legacyPreferenceId: existing || null,
  };
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

function normalizeDashboardPromptSets(promptSets: PromptSet[]): PromptSet[] {
  return promptSets
    .map((promptSet) =>
      buildCurrentPromptSet({
        id: promptSet.id,
        name: promptSet.name,
        scrapeSystemPrompt: promptSet.scrapeSystemPrompt || defaultScrapeSystemPrompt,
        scrapeTaskPrompt: promptSet.scrapeTaskPrompt || defaultScrapeTaskPrompt,
        copySystemPrompt: promptSet.copySystemPrompt || defaultCopySystemPrompt,
        copyTaskPrompt: promptSet.copyTaskPrompt || defaultCopyTaskPrompt,
        imageSystemPrompt: promptSet.imageSystemPrompt || defaultImageSystemPrompt,
        imageTaskPrompt: promptSet.imageTaskPrompt || defaultImageTaskPrompt,
        updatedAt: promptSet.updatedAt,
      }),
    )
    .filter((promptSet) => promptSet.id && promptSet.name);
}

function buildCurrentPromptSet(input: {
  id: string;
  name: string;
  scrapeSystemPrompt: string;
  scrapeTaskPrompt: string;
  copySystemPrompt: string;
  copyTaskPrompt: string;
  imageSystemPrompt: string;
  imageTaskPrompt: string;
  updatedAt?: string;
}): PromptSet {
  return {
    id: input.id,
    name: input.name.trim() || "Untitled prompt set",
    scrapeSystemPrompt: input.scrapeSystemPrompt,
    scrapeTaskPrompt: input.scrapeTaskPrompt,
    copySystemPrompt: input.copySystemPrompt,
    copyTaskPrompt: input.copyTaskPrompt,
    imageSystemPrompt: input.imageSystemPrompt,
    imageTaskPrompt: input.imageTaskPrompt,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function upsertPromptSet(promptSets: PromptSet[], promptSet: PromptSet) {
  const next = promptSets.filter((current) => current.id !== promptSet.id);
  return [promptSet, ...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function findPromptSet(promptSets: PromptSet[], promptSetId?: string) {
  return promptSets.find((promptSet) => promptSet.id === promptSetId) ?? null;
}

function applyPromptSetState(
  promptSet: PromptSet,
  setters: {
    setSelectedPromptSetId: (value: string) => void;
    setPromptSetName: (value: string) => void;
    setScrapeSystemPrompt: (value: string) => void;
    setScrapeTaskPrompt: (value: string) => void;
    setCopySystemPrompt: (value: string) => void;
    setCopyTaskPrompt: (value: string) => void;
    setImageSystemPrompt: (value: string) => void;
    setImageTaskPrompt: (value: string) => void;
  },
) {
  setters.setSelectedPromptSetId(promptSet.id);
  setters.setPromptSetName(promptSet.name);
  setters.setScrapeSystemPrompt(promptSet.scrapeSystemPrompt);
  setters.setScrapeTaskPrompt(promptSet.scrapeTaskPrompt);
  setters.setCopySystemPrompt(promptSet.copySystemPrompt);
  setters.setCopyTaskPrompt(promptSet.copyTaskPrompt);
  setters.setImageSystemPrompt(promptSet.imageSystemPrompt);
  setters.setImageTaskPrompt(promptSet.imageTaskPrompt);
}

function serializePreferences(input: {
  sources: NewsSource[];
  copyModel: string;
  scrapeModel: string;
  imageModel: string;
  promptSets: PromptSet[];
  lastPromptSetId: string;
}) {
  return JSON.stringify({
    sources: normalizeDashboardSources(input.sources),
    copyModel: input.copyModel,
    scrapeModel: input.scrapeModel,
    imageModel: input.imageModel,
    promptSets: normalizeDashboardPromptSets(input.promptSets),
    lastPromptSetId: input.lastPromptSetId,
  });
}
