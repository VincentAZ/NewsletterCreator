"use client";

import { ChangeEvent, useMemo, useState } from "react";
import type {
  Article,
  Balances,
  GeneratedImage,
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

type ApprovalPayload = {
  approval?: { id: string; status: string; approvedAt: string };
  error?: string;
  balances: Balances;
};

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

export function NewsletterDashboard() {
  const [openRouterModels, setOpenRouterModels] = useState<ProviderModel[]>([]);
  const [falModels, setFalModels] = useState<ProviderModel[]>([]);
  const [copyModel, setCopyModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<NewsletterDraft | null>(null);
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [balances, setBalances] = useState<Balances>(emptyBalances);
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [imageFeedback, setImageFeedback] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [status, setStatus] = useState("Load models and sources to start.");
  const [isBusy, setIsBusy] = useState(false);

  const selectedArticles = useMemo(() => {
    return articles.filter((article) => selectedArticleIds.has(article.id));
  }, [articles, selectedArticleIds]);

  const allSectionsApproved = draft?.sections.every((section) => section.approved) ?? false;
  const canGenerateDraft = copyModel && selectedArticles.length > 0 && !isBusy;
  const canGenerateImage = draft?.imagePrompt.trim() && imageModel && !isBusy;
  const canApprove = Boolean(draft && validation?.valid && image && allSectionsApproved && !isBusy);

  async function loadModels() {
    setIsBusy(true);
    setStatus("Fetching OpenRouter and fal.ai model catalogs.");
    const payload = await fetchJson<ModelsPayload>("/api/newsletter/models");
    setOpenRouterModels(payload.openRouterModels);
    setFalModels(payload.falModels);
    setCopyModel((current) => current || payload.openRouterModels[0]?.id || "");
    setImageModel((current) => current || payload.falModels[0]?.id || "");
    setBalances(payload.balances);
    setStatus("Models loaded. Choose copy and image models before generation.");
    setIsBusy(false);
  }

  async function loadArticles() {
    setIsBusy(true);
    setStatus("Gathering and deduping newsletter sources.");
    const payload = await fetchJson<ArticlesPayload>("/api/newsletter/articles");
    setArticles(payload.articles);
    setSelectedArticleIds(new Set(payload.articles.slice(0, 30).map((article) => article.id)));
    setBalances(payload.balances);
    setStatus(payload.error ?? `Loaded ${payload.articles.length} deduped stories from ${payload.sourceCount} sources.`);
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
      setValidation(payload.validation);
      setStatus(payload.usedFallback ? "Draft created with local fallback. Review before approval." : "Draft created.");
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
      setStatus("Hero image generated. Review it before final approval.");
    } else {
      setStatus(payload.error ?? "Image generation failed.");
    }

    setBalances(payload.balances);
    setIsBusy(false);
  }

  async function submitApproval(statusValue: "approved" | "rejected") {
    if (!draft) {
      return;
    }

    setIsBusy(true);
    setStatus(statusValue === "approved" ? "Recording approval." : "Recording rejection.");
    const payload = await postJson<ApprovalPayload>("/api/newsletter/approve", {
      draft,
      image,
      status: statusValue,
      notes: approvalNotes,
    });
    setBalances(payload.balances);
    setStatus(
      payload.approval
        ? `${payload.approval.status} as ${payload.approval.id}.`
        : payload.error ?? "Approval request failed.",
    );
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

  return (
    <div className="newsletterApp">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Daily Newsletter</p>
          <h1>AI-news production with editorial approval.</h1>
        </div>
        <div className="balanceBar">
          <BalancePill balance={balances.openRouter} />
          <BalancePill balance={balances.fal} />
        </div>
      </header>

      <section className="toolbar">
        <label>
          Copy model
          <select value={copyModel} onChange={(event) => setCopyModel(event.target.value)}>
            {openRouterModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Image model
          <select value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
            {falModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={loadModels} disabled={isBusy}>
          Load models
        </button>
        <button type="button" onClick={loadArticles} disabled={isBusy}>
          Gather news
        </button>
      </section>

      <p className="statusLine">{status}</p>

      <main className="workspace">
        <aside className="sourcePane">
          <div className="paneHeader">
            <h2>Source Queue</h2>
            <span>{selectedArticles.length} selected</span>
          </div>
          <div className="articleList">
            {articles.map((article) => (
              <label className="articleRow" key={article.id}>
                <input
                  type="checkbox"
                  checked={selectedArticleIds.has(article.id)}
                  onChange={() => toggleArticle(article.id)}
                />
                <span>
                  <strong>{article.title}</strong>
                  <small>
                    {article.source} · score {article.score}
                  </small>
                </span>
              </label>
            ))}
          </div>
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
                        type="checkbox"
                        checked={Boolean(section.approved)}
                        onChange={(event) => updateSection(sectionIndex, { ...section, approved: event.target.checked })}
                      />
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
            <div className="emptyState">Generate copy after selecting stories and a model.</div>
          )}
        </section>

        <aside className="publishPane">
          <div className="paneHeader">
            <h2>Image & Approval</h2>
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

          <div className="qualityBox">
            <strong>Quality Gate</strong>
            <span>Schema: {validation?.valid ? "valid" : "pending"}</span>
            <span>Sections: {allSectionsApproved ? "approved" : "need review"}</span>
            <span>Image: {image ? image.contentType : "pending"}</span>
          </div>

          <label className="fieldBlock">
            Approval notes
            <textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} />
          </label>

          <div className="approvalActions">
            <button type="button" className="secondary" onClick={() => submitApproval("rejected")} disabled={!draft || isBusy}>
              Reject
            </button>
            <button type="button" onClick={() => submitApproval("approved")} disabled={!canApprove}>
              Approve
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function BalancePill({ balance }: { balance: ProviderBalance }) {
  const amount = balance.balance === null ? "Unavailable" : `${balance.currency} ${balance.balance.toFixed(4)}`;
  return (
    <div className={`balancePill ${balance.status}`}>
      <span>{balance.label}</span>
      <strong>{amount}</strong>
    </div>
  );
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
