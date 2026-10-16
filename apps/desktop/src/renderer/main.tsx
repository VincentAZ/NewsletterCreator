import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  newBlock,
  newIssue,
  newProfile,
  renderEmail,
  type Article,
  type Block,
  type DesktopApi,
  type Issue,
  type Library,
  type Profile,
  type Progress,
  type Settings,
  type SetupStatus,
  type SourceOutcome,
} from "@newsletter/core";
import "./styles.css";

declare global {
  interface Window {
    newsletter: DesktopApi;
  }
}
const api = window.newsletter;
type Page =
  | "library"
  | "newsletter"
  | "sources"
  | "editor"
  | "preview"
  | "settings"
  | "setup";
const navigation: Array<{ id: Page; label: string; icon: string }> = [
  { id: "library", label: "Your library", icon: "▦" },
  { id: "newsletter", label: "Newsletter", icon: "◉" },
  { id: "sources", label: "Source inbox", icon: "▤" },
  { id: "editor", label: "Write an issue", icon: "✎" },
  { id: "preview", label: "Preview & export", icon: "↗" },
];

function App() {
  const [library, setLibrary] = useState<Library>();
  const [page, setPage] = useState<Page>("library");
  const [issue, setIssue] = useState<Issue>();
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [jobId, setJobId] = useState("");
  const [saveState, setSaveState] = useState("Saved on this computer");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<Issue[]>([]);
  const [outcomes, setOutcomes] = useState<SourceOutcome[]>([]);
  const [setup, setSetup] = useState<SetupStatus>();
  const latest = useRef<Issue | undefined>(undefined);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revision = useRef(new Map<string, number>());
  const profile =
    library?.profiles.find(
      (candidate) => candidate.id === (issue?.profileId || profileId),
    ) || library?.profiles[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);
  const reload = useCallback(async () => {
    const data = await api.invoke("library", {});
    setLibrary(data);
    for (const item of data.issues)
      revision.current.set(item.id, item.revision);
    return data;
  }, []);
  useEffect(() => {
    void reload().catch((error: Error) => setError(error.message));
    return api.onProgress(setProgress);
  }, [reload]);
  useEffect(() => {
    for (const block of issue?.blocks || [])
      if (block.assetId && !assets[block.assetId])
        void api
          .invoke("readAsset", { id: block.assetId })
          .then((data) =>
            setAssets((current) => ({ ...current, [block.assetId]: data })),
          )
          .catch((error: Error) => setError(error.message));
  }, [issue, assets]);

  async function flush() {
    clearTimeout(timer.current);
    if (saving.current) {
      await saving.current;
      if (dirty.current) return flush();
      return;
    }
    if (!dirty.current || !latest.current) return;
    saving.current = (async () => {
      while (dirty.current && latest.current) {
        const snapshot = latest.current;
        dirty.current = false;
        setSaveState("Saving…");
        try {
          const saved = await api.invoke("saveIssue", {
            ...snapshot,
            revision: revision.current.get(snapshot.id) ?? snapshot.revision,
          });
          revision.current.set(saved.id, saved.revision);
          if (latest.current?.id === saved.id) {
            latest.current = { ...latest.current, revision: saved.revision };
            setIssue(latest.current);
          }
          setLibrary((current) =>
            current
              ? {
                  ...current,
                  issues: [
                    saved,
                    ...current.issues.filter(
                      (candidate) => candidate.id !== saved.id,
                    ),
                  ],
                }
              : current,
          );
          setSaveState("Saved on this computer");
        } catch (error) {
          dirty.current = true;
          setSaveState("Not saved · retry before leaving");
          throw error;
        }
      }
    })();
    try {
      await saving.current;
    } finally {
      saving.current = null;
    }
  }
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        event.preventDefault();
        event.returnValue = "";
        void flush().catch(() => {});
      }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  });
  function change(next: Issue, remember = false) {
    if (remember && latest.current)
      setUndo((history) => [
        ...history.slice(-19),
        structuredClone(latest.current!),
      ]);
    latest.current = next;
    setIssue(next);
    dirty.current = true;
    setSaveState("Unsaved changes");
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void flush().catch((error: Error) => setError(error.message)),
      500,
    );
  }
  async function act(work: () => Promise<unknown>, message = "") {
    setError("");
    setBusy(true);
    setProgress(undefined);
    setStatus(message);
    try {
      await work();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      return false;
    } finally {
      setBusy(false);
      setJobId("");
    }
  }
  async function navigate(next: Page) {
    await act(async () => {
      await flush();
      setPage(next);
      if (next === "setup") setSetup(await api.invoke("setupStatus", {}));
    });
  }
  async function openIssue(item: Issue) {
    await flush();
    latest.current = item;
    revision.current.set(item.id, item.revision);
    setIssue(item);
    setProfileId(item.profileId);
    setUndo([]);
    setPage("editor");
  }
  async function createIssue(selected = profile) {
    if (!selected) {
      setPage("newsletter");
      return;
    }
    await openIssue(
      await api.invoke(
        "saveIssue",
        newIssue(
          selected.id,
          `${selected.name} · ${new Date().toLocaleDateString()}`,
        ),
      ),
    );
    await reload();
  }
  async function saveProfile(value: Profile) {
    const saved = await api.invoke("saveProfile", value);
    setProfileId(saved.id);
    await reload();
    setStatus("Newsletter settings saved.");
    return saved;
  }
  async function collect() {
    if (!profile) return;
    if (!latest.current) await createIssue(profile);
    await flush();
    const id = crypto.randomUUID();
    setJobId(id);
    const result = await api.invoke("gather", {
      jobId: id,
      issueId: latest.current!.id,
      profileId: profile.id,
    });
    setOutcomes(result.outcomes);
    const current = latest.current!;
    const existing = new Set(current.articles.map((article) => article.url));
    change({
      ...current,
      articles: [
        ...current.articles,
        ...result.articles.filter((article) => !existing.has(article.url)),
      ].slice(0, 300),
    });
    await flush();
    setPage("sources");
    setStatus(
      `Collected ${result.articles.length} stories. Choose what belongs in this issue.`,
    );
  }
  async function generate(blockId?: string, feedback = "") {
    if (!latest.current) return;
    await flush();
    const id = crypto.randomUUID();
    setJobId(id);
    const result = await api.invoke("generate", {
      jobId: id,
      issueId: latest.current.id,
      blockId,
      feedback,
    });
    const current = latest.current!;
    change(
      blockId
        ? {
            ...current,
            blocks: current.blocks.map((block) =>
              block.id === blockId
                ? { ...result.blocks[0], id: block.id }
                : block,
            ),
          }
        : {
            ...current,
            subject: result.subject,
            preheader: result.preheader,
            intro: result.intro,
            blocks: [
              ...current.blocks.filter((block) => block.kind !== "story"),
              ...result.blocks,
            ],
          },
      true,
    );
    await flush();
    setStatus(
      "Copy is ready for your review. Original content has been preserved.",
    );
  }
  async function addImage(prompt?: string) {
    if (!latest.current) return;
    const id = crypto.randomUUID();
    setJobId(id);
    const result = prompt
      ? await api.invoke("image", { jobId: id, prompt })
      : await api.invoke("pickImage", {});
    if (result)
      change(
        {
          ...latest.current,
          blocks: [
            ...latest.current.blocks,
            {
              ...newBlock("image"),
              assetId: result.assetId,
              alt: prompt || "Newsletter image",
            },
          ],
        },
        true,
      );
  }
  function updateBlock(block: Block) {
    if (latest.current)
      change({
        ...latest.current,
        blocks: latest.current.blocks.map((value) =>
          value.id === block.id ? block : value,
        ),
      });
  }

  if (!library)
    return (
      <div className="loading">
        <div className="brand-mark">
          N<span>·</span>
        </div>
        <h1>Opening your workspace</h1>
        <p>{error || "Your newsletters stay on this computer."}</p>
      </div>
    );
  const selected =
    issue?.articles.filter((article) => article.selected).length || 0;
  const names = {
    library: "A good newsletter starts here.",
    newsletter: "Make it yours.",
    sources: "Find the stories worth sharing.",
    editor: "Give your ideas a voice.",
    preview: "Ready for your readers.",
    settings: "Your tools. Your choice.",
    setup: "Your own creative engine.",
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            N<span>·</span>
          </div>
          <div>
            Newsletter<span>Creator</span>
          </div>
        </div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => void navigate(item.id)}
              disabled={busy}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> Local by default
          <p>
            Stored on your computer.
            <br />
            Shared when you choose.
          </p>
        </div>
        <div className="bottom-nav">
          <button
            className={page === "setup" ? "nav-item active" : "nav-item"}
            onClick={() => void navigate("setup")}
            disabled={busy}
          >
            <span>◈</span>Local AI setup
          </button>
          <button
            className={page === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => void navigate("settings")}
            disabled={busy}
          >
            <span>⚙</span>Settings
          </button>
          <small>NewsletterCreator · Preview 0.1</small>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {navigation.find((item) => item.id === page)?.label ||
              (page === "setup" ? "Local AI setup" : "Settings")}
          </div>
          <div className="topbar-right">
            {issue && (
              <button className="save-status" onClick={() => void act(flush)}>
                {saveState}
              </button>
            )}
            <span className="avatar">{(profile?.name || "N").slice(0, 1)}</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "editor" || page === "preview"
                  ? profile?.name || "YOUR NEWSLETTER"
                  : "A LITTLE MORE HUMAN. A LOT MORE YOU."}
              </div>
              <h1>{names[page]}</h1>
              <p>
                {page === "library"
                  ? "A home for your ideas, your audience, and your next great issue."
                  : page === "sources"
                    ? "Bring in the news. Add your perspective. Keep the final say."
                    : page === "setup"
                      ? "Write and create images locally, with a setup that guides you."
                      : ""}
              </p>
            </div>
            {page === "library" && (
              <button
                className="primary"
                onClick={() => void act(() => createIssue())}
                disabled={busy || !profile}
              >
                ＋ New issue
              </button>
            )}
          </div>
          {error && (
            <div className="notice error" role="alert">
              <strong>Something needs attention</strong>
              <p>{error}</p>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {busy && (
            <div className="notice progress" role="status">
              <span className="spinner" />
              {progress?.message || status || "Working…"}
              {progress?.total ? (
                <progress
                  value={progress.completed || 0}
                  max={progress.total}
                />
              ) : null}
              {jobId && (
                <button onClick={() => void api.invoke("cancel", { jobId })}>
                  Cancel
                </button>
              )}
            </div>
          )}
          {!busy && status && (
            <div className="notice quiet" role="status">
              {status}
            </div>
          )}

          {page === "library" && (
            <>
              <div className="library-stats">
                <div>
                  <span>NEWSLETTERS</span>
                  <strong>
                    {library.profiles.length.toString().padStart(2, "0")}
                  </strong>
                </div>
                <div>
                  <span>ISSUES IN YOUR LIBRARY</span>
                  <strong>
                    {library.issues.length.toString().padStart(2, "0")}
                  </strong>
                </div>
                <div className="stats-note">
                  <span className="status-dot" />
                  <p>
                    Your work belongs to you.
                    <br />
                    <small>No account. No mandatory cloud.</small>
                  </p>
                </div>
              </div>
              <div className="section-heading">
                <h2>Your newsletters</h2>
                <button
                  className="text-button"
                  onClick={() => {
                    setProfileId("");
                    latest.current = undefined;
                    setIssue(undefined);
                    setPage("newsletter");
                  }}
                >
                  ＋ Create a newsletter
                </button>
              </div>
              {!library.profiles.length ? (
                <div className="welcome-card">
                  <div>
                    <span className="pill">START SOMETHING WORTH READING</span>
                    <h2>
                      News, notes, and your
                      <br />
                      own point of view.
                    </h2>
                    <p>
                      For a community, a business, or a topic you love.
                      <br />
                      Start with your audience. We’ll help with the rest.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setPage("newsletter")}
                    >
                      Create your first newsletter →
                    </button>
                  </div>
                  <div className="paper-illustration" aria-hidden="true">
                    <small>THE WEEKLY EDIT</small>
                    <div className="paper-title">
                      A fresh
                      <br />
                      perspective.
                    </div>
                    <div className="paper-art">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="paper-lines" />
                  </div>
                </div>
              ) : (
                <div className="profile-grid">
                  {library.profiles.map((item) => (
                    <button
                      key={item.id}
                      className="profile-card"
                      onClick={() => {
                        setProfileId(item.id);
                        latest.current = undefined;
                        setIssue(undefined);
                        setPage("newsletter");
                      }}
                    >
                      <div
                        className="profile-monogram"
                        style={{ background: item.brandColor }}
                      >
                        {item.name.slice(0, 1)}
                      </div>
                      <h3>{item.name}</h3>
                      <p>{item.topic || "Your next perspective"}</p>
                      <small>
                        {
                          library.issues.filter(
                            (issue) => issue.profileId === item.id,
                          ).length
                        }{" "}
                        issues <span>Open newsletter ↗</span>
                      </small>
                    </button>
                  ))}
                </div>
              )}
              <div className="section-heading">
                <h2>Recent issues</h2>
                <span>
                  {library.issues.length
                    ? "Pick up where you left off"
                    : "Your story starts with the first issue"}
                </span>
              </div>
              <div className="issue-list">
                {library.issues.length ? (
                  library.issues.map((item) => (
                    <div className="issue-row" key={item.id}>
                      <div className="issue-symbol">▤</div>
                      <button
                        className="issue-title"
                        onClick={() => void act(() => openIssue(item))}
                      >
                        <strong>{item.title}</strong>
                        <span>
                          {
                            library.profiles.find(
                              (profile) => profile.id === item.profileId,
                            )?.name
                          }{" "}
                          · {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <span className="pill muted">Draft</span>
                      <button
                        className="text-button"
                        onClick={() =>
                          void act(async () => {
                            await flush();
                            await openIssue(
                              await api.invoke("saveIssue", {
                                ...item,
                                id: crypto.randomUUID(),
                                title: item.title + " (copy)",
                                revision: 0,
                              }),
                            );
                            await reload();
                          })
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => {
                          if (confirm(`Delete “${item.title}”?`))
                            void act(async () => {
                              await api.invoke("deleteIssue", { id: item.id });
                              if (latest.current?.id === item.id) {
                                latest.current = undefined;
                                setIssue(undefined);
                                dirty.current = false;
                              }
                              await reload();
                            });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-small">
                    A blank page is a good place to begin.
                  </div>
                )}
              </div>
            </>
          )}

          {page === "newsletter" && (
            <ProfileEditor
              key={profileId || "new"}
              profile={
                profileId
                  ? library.profiles.find((item) => item.id === profileId)
                  : undefined
              }
              busy={busy}
              save={(value) =>
                act(async () => {
                  const saved = await saveProfile(value);
                  setProfileId(saved.id);
                })
              }
              createIssue={() => void act(() => createIssue(profile))}
              remove={(id) =>
                void act(async () => {
                  await api.invoke("deleteProfile", { id });
                  setProfileId("");
                  await reload();
                })
              }
            />
          )}

          {page === "sources" && (
            <>
              {!profile ? (
                <Empty
                  title="Start with a newsletter"
                  body="Choose a topic and audience before collecting stories."
                  action={() => setPage("newsletter")}
                  label="Create a newsletter"
                />
              ) : (
                <>
                  <div className="workflow-banner">
                    <div>
                      <strong>{profile.name}</strong>
                      <span>
                        {profile.freshnessDays}-day freshness window ·{" "}
                        {
                          profile.sources.filter((source) => source.enabled)
                            .length
                        }{" "}
                        sources · {selected} stories selected
                      </span>
                    </div>
                    <button
                      className="primary"
                      disabled={busy || !profile.sources.length}
                      onClick={() => void act(collect)}
                    >
                      ↻ Gather stories
                    </button>
                  </div>
                  <SourceManager
                    profile={profile}
                    busy={busy}
                    save={(value) => act(() => saveProfile(value))}
                  />
                  {outcomes.length > 0 && (
                    <div className="source-outcomes">
                      {outcomes.map((outcome, i) => (
                        <div
                          key={i}
                          className={outcome.error ? "source-failed" : ""}
                        >
                          {outcome.error ? "!" : "✓"} {outcome.name}:{" "}
                          {outcome.error || `${outcome.count} stories`}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="section-heading">
                    <h2>
                      Collected stories{" "}
                      <span className="count">
                        {issue?.articles.length || 0}
                      </span>
                    </h2>
                    <div className="button-row">
                      <button
                        onClick={() =>
                          latest.current &&
                          change({
                            ...latest.current,
                            articles: latest.current.articles.map(
                              (article) => ({ ...article, selected: true }),
                            ),
                          })
                        }
                      >
                        Select all
                      </button>
                      <button
                        onClick={() =>
                          latest.current &&
                          change({
                            ...latest.current,
                            articles: latest.current.articles.map(
                              (article) => ({ ...article, selected: false }),
                            ),
                          })
                        }
                      >
                        Clear
                      </button>
                      <button
                        className="primary"
                        disabled={!selected || busy}
                        onClick={() => void navigate("editor")}
                      >
                        Write with these stories →
                      </button>
                    </div>
                  </div>
                  {issue?.articles.length ? (
                    <div className="story-grid">
                      {issue.articles.map((article) => (
                        <Story
                          key={article.id}
                          article={article}
                          disabled={busy}
                          toggle={() =>
                            change({
                              ...issue,
                              articles: issue.articles.map((item) =>
                                item.id === article.id
                                  ? { ...item, selected: !item.selected }
                                  : item,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="A quieter inbox. Better stories."
                      body="Add an RSS feed, a website, or a specific article above. Gather only when you’re ready."
                    />
                  )}
                </>
              )}
            </>
          )}

          {page === "editor" && (
            <>
              {!issue ? (
                <Empty
                  title="Your next issue is a blank canvas"
                  body="Start an issue to combine stories with your own updates and ideas."
                  action={() => void act(() => createIssue())}
                  label="Start an issue"
                />
              ) : (
                <div className="editor-layout">
                  <section className="editor-sheet">
                    <div className="editor-toolbar">
                      <span className="pill">DRAFT</span>
                      <span>{selected} sources selected</span>
                      <button
                        className="text-button"
                        disabled={!undo.length || busy}
                        onClick={() => {
                          const previous = undo.at(-1)!;
                          setUndo(undo.slice(0, -1));
                          change({
                            ...previous,
                            revision: latest.current!.revision,
                          });
                        }}
                      >
                        ↶ Undo
                      </button>
                      <button
                        className="primary"
                        disabled={busy || (!selected && !issue.blocks.length)}
                        onClick={() => void act(() => generate())}
                      >
                        ✦ Draft with AI
                      </button>
                    </div>
                    <fieldset disabled={busy}>
                      <Field
                        label="Issue name"
                        value={issue.title}
                        onChange={(title) => change({ ...issue, title })}
                      />
                      <Field
                        label="Email subject"
                        value={issue.subject}
                        onChange={(subject) => change({ ...issue, subject })}
                        placeholder="A reason to open this email"
                      />
                      <Field
                        label="Preview text"
                        value={issue.preheader}
                        onChange={(preheader) =>
                          change({ ...issue, preheader })
                        }
                        placeholder="The little line that follows your subject"
                      />
                      <Field
                        label="Your introduction"
                        value={issue.intro}
                        onChange={(intro) => change({ ...issue, intro })}
                        multiline
                        placeholder="A note to your readers…"
                      />
                      {issue.blocks.map((block, index) => (
                        <BlockEditor
                          key={block.id}
                          block={block}
                          index={index}
                          count={issue.blocks.length}
                          image={assets[block.assetId]}
                          change={updateBlock}
                          regenerate={(feedback) =>
                            void act(() => generate(block.id, feedback))
                          }
                          remove={() =>
                            change(
                              {
                                ...issue,
                                blocks: issue.blocks.filter(
                                  (item) => item.id !== block.id,
                                ),
                              },
                              true,
                            )
                          }
                          move={(delta) => {
                            const blocks = [...issue.blocks];
                            [blocks[index], blocks[index + delta]] = [
                              blocks[index + delta],
                              blocks[index],
                            ];
                            change({ ...issue, blocks }, true);
                          }}
                        />
                      ))}
                    </fieldset>
                    <div className="add-block">
                      <span>Add your perspective</span>
                      {(["text", "event", "cta"] as const).map((kind) => (
                        <button
                          disabled={busy}
                          key={kind}
                          onClick={() =>
                            change(
                              {
                                ...issue,
                                blocks: [...issue.blocks, newBlock(kind)],
                              },
                              true,
                            )
                          }
                        >
                          ＋{" "}
                          {kind === "cta"
                            ? "Call to action"
                            : kind === "text"
                              ? "Text"
                              : "Event"}
                        </button>
                      ))}
                      <button
                        disabled={busy}
                        onClick={() => void act(() => addImage())}
                      >
                        ＋ Image
                      </button>
                    </div>
                    <div className="editor-footer">
                      <span>{saveState}</span>
                      <button
                        className="primary"
                        onClick={() => void navigate("preview")}
                        disabled={busy}
                      >
                        Preview issue →
                      </button>
                    </div>
                  </section>
                  <aside className="editor-aside">
                    <div className="tip-card">
                      <span className="eyebrow">YOUR EDITORIAL BRIEF</span>
                      <h3>{profile?.name}</h3>
                      <p>{profile?.topic || "Every topic has a story."}</p>
                      <dl>
                        <dt>Writing for</dt>
                        <dd>{profile?.audience || "Your readers"}</dd>
                        <dt>Voice</dt>
                        <dd>{profile?.tone}</dd>
                      </dl>
                    </div>
                    <ImageComposer
                      busy={busy}
                      provider={library.settings.imageProvider}
                      generate={(prompt) => void act(() => addImage(prompt))}
                    />
                    <div className="tip-card subtle">
                      <h3>The final word is yours.</h3>
                      <p>
                        Review facts, names, and dates. AI works from your
                        source material, which may be incomplete.
                      </p>
                    </div>
                  </aside>
                </div>
              )}
            </>
          )}

          {page === "preview" && (
            <>
              {issue && profile ? (
                <Preview
                  profile={profile}
                  issue={issue}
                  assets={assets}
                  busy={busy}
                  exportHtml={() =>
                    void act(async () => {
                      await flush();
                      const path = await api.invoke("exportHtml", {
                        issueId: issue.id,
                      });
                      if (path) setStatus(`Exported to ${path}`);
                    })
                  }
                  mailchimp={() =>
                    void act(async () => {
                      await flush();
                      const id = crypto.randomUUID();
                      setJobId(id);
                      const result = await api.invoke("mailchimp", {
                        jobId: id,
                        issueId: issue.id,
                      });
                      setStatus(
                        `Mailchimp draft created: ${result.campaignId}. Review and send in Mailchimp.`,
                      );
                      await api.invoke("openExternal", { url: result.url });
                    })
                  }
                />
              ) : (
                <Empty
                  title="Something good is taking shape"
                  body="Create an issue to preview how it will look in your readers’ inboxes."
                  action={() => void navigate("editor")}
                  label="Go to the editor"
                />
              )}
            </>
          )}

          {page === "settings" && (
            <SettingsEditor
              key={JSON.stringify(library.settings)}
              library={library}
              busy={busy}
              run={act}
              saved={async () => {
                await reload();
                setStatus("Settings saved.");
              }}
              restore={async () => {
                await flush();
                if (await api.invoke("restore", {})) {
                  latest.current = undefined;
                  setIssue(undefined);
                  setProfileId("");
                  dirty.current = false;
                  await reload();
                  setStatus(
                    "Backup restored. Your previous data was backed up first.",
                  );
                }
              }}
              importComplete={async () => {
                await reload();
                setStatus(
                  "Preferences imported. The original Supabase data is unchanged.",
                );
              }}
            />
          )}
          {page === "setup" && (
            <SetupPanel
              status={setup}
              busy={busy}
              refresh={() =>
                void act(async () =>
                  setSetup(await api.invoke("setupStatus", {})),
                )
              }
              install={(engine) =>
                void act(async () => {
                  const id = crypto.randomUUID();
                  setJobId(id);
                  setSetup(
                    await api.invoke("install", {
                      jobId: id,
                      engine,
                      acceptTerms: true,
                    }),
                  );
                  await reload();
                  setStatus(
                    "Setup finished. Check your model selection in Settings before generating.",
                  );
                })
              }
              start={(engine) =>
                void act(async () =>
                  setSetup(await api.invoke("startEngine", { engine })),
                )
              }
              stop={(engine) =>
                void act(async () =>
                  setSetup(await api.invoke("stopEngine", { engine })),
                )
              }
            />
          )}
          <footer className="page-footer">
            <span>Made for your point of view.</span>
            <span>Local storage · Intentional connections</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
function Empty({
  title,
  body,
  action,
  label,
}: {
  title: string;
  body: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">✳</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action && (
        <button className="primary" onClick={action}>
          {label}
        </button>
      )}
    </div>
  );
}

function ProfileEditor({
  profile,
  busy,
  save,
  createIssue,
  remove,
}: {
  profile?: Profile;
  busy: boolean;
  save: (profile: Profile) => Promise<boolean>;
  createIssue: () => void;
  remove: (id: string) => void;
}) {
  const [value, setValue] = useState(profile || newProfile());
  useEffect(() => {
    if (profile) setValue(profile);
  }, [profile]);
  const patch = (values: Partial<Profile>) => setValue({ ...value, ...values });
  function preset(kind: string) {
    patch(
      kind === "ai"
        ? {
            name: "The AI Edit",
            topic: "Artificial intelligence news and practical applications",
            audience: "Curious professionals",
            freshnessDays: 3,
          }
        : kind === "community"
          ? {
              name: "Around the Neighborhood",
              topic: "Community news, local events, and neighbor stories",
              audience: "Local residents",
              tone: "Warm, welcoming, and helpful",
              freshnessDays: 14,
            }
          : {
              name: "Inside the Business",
              topic: "Company updates, useful advice, and upcoming offers",
              audience: "Customers and prospective customers",
              tone: "Friendly and knowledgeable",
              freshnessDays: 30,
            },
    );
  }
  return (
    <div className="form-layout">
      <section className="panel">
        <div className="section-heading">
          <h2>
            {profile ? "Newsletter identity" : "Meet your next newsletter"}
          </h2>
          <span>1 / A clear point of view</span>
        </div>
        {!profile && (
          <div className="preset-row">
            <span>Start with a direction</span>
            <button onClick={() => preset("community")}>Community</button>
            <button onClick={() => preset("business")}>Small business</button>
            <button onClick={() => preset("ai")}>AI news</button>
          </div>
        )}
        <fieldset disabled={busy}>
          <Field
            label="Newsletter name"
            value={value.name}
            onChange={(name) => patch({ name })}
          />
          <Field
            label="What is it about?"
            value={value.topic}
            onChange={(topic) => patch({ topic })}
            multiline
            placeholder="A subject you know, a community you care about…"
          />
          <Field
            label="Who are you writing for?"
            value={value.audience}
            onChange={(audience) => patch({ audience })}
          />
          <div className="field-pair">
            <Field
              label="Voice and tone"
              value={value.tone}
              onChange={(tone) => patch({ tone })}
            />
            <Field
              label="Language"
              value={value.language}
              onChange={(language) => patch({ language })}
            />
          </div>
          <div className="field-pair">
            <Field
              label="Freshness window (days)"
              type="number"
              value={String(value.freshnessDays)}
              onChange={(days) => patch({ freshnessDays: Number(days) })}
            />
            <Field
              label="Brand color"
              type="color"
              value={value.brandColor}
              onChange={(brandColor) => patch({ brandColor })}
            />
          </div>
          <Field
            label="Organization"
            value={value.organization}
            onChange={(organization) => patch({ organization })}
          />
          <Field
            label="Footer / contact information"
            value={value.footer}
            onChange={(footer) => patch({ footer })}
            multiline
          />
          <div className="field-pair">
            <Field
              label="Optional call-to-action label"
              value={value.ctaLabel}
              onChange={(ctaLabel) => patch({ ctaLabel })}
            />
            <Field
              label="Call-to-action URL"
              value={value.ctaUrl}
              onChange={(ctaUrl) => patch({ ctaUrl })}
            />
          </div>
        </fieldset>
        <div className="button-row">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void save(value)}
          >
            Save newsletter
          </button>
          {profile && (
            <button disabled={busy} onClick={createIssue}>
              Start an issue →
            </button>
          )}
          {profile && (
            <button
              className="danger text-button"
              disabled={busy}
              onClick={() =>
                confirm("Delete this newsletter? Remove its issues first.") &&
                remove(profile.id)
              }
            >
              Delete
            </button>
          )}
        </div>
      </section>
      <aside>
        <div className="tip-card">
          <span className="eyebrow">A SIMPLE START</span>
          <h3>Specific beats generic.</h3>
          <p>
            “Helpful advice for first-time gardeners in Phoenix” gives your
            newsletter more direction than “gardening.”
          </p>
          <p>
            These settings guide AI suggestions. Your voice and decisions stay
            in charge.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SourceManager({
  profile,
  busy,
  save,
}: {
  profile: Profile;
  busy: boolean;
  save: (profile: Profile) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"rss" | "website" | "article">("rss");
  return (
    <details className="panel source-manager" open={!profile.sources.length}>
      <summary>
        Your sources <span>{profile.sources.length} connected</span>
      </summary>
      <div className="source-list">
        {profile.sources.map((source) => (
          <div key={source.id}>
            <input
              aria-label={`Include ${source.name}`}
              type="checkbox"
              checked={source.enabled}
              disabled={busy}
              onChange={(event) =>
                void save({
                  ...profile,
                  sources: profile.sources.map((value) =>
                    value.id === source.id
                      ? { ...value, enabled: event.target.checked }
                      : value,
                  ),
                })
              }
            />
            <div>
              <strong>{source.name}</strong>
              <small>{source.url}</small>
            </div>
            <span className="pill muted">{source.type}</span>
            <button
              disabled={busy}
              aria-label={`Remove ${source.name}`}
              onClick={() =>
                void save({
                  ...profile,
                  sources: profile.sources.filter(
                    (value) => value.id !== source.id,
                  ),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="source-form">
        <Field
          label="Source name"
          value={name}
          onChange={setName}
          placeholder="A publication you trust"
        />
        <label className="field">
          <span>Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="rss">RSS feed</option>
            <option value="website">Website</option>
            <option value="article">Article URL</option>
          </select>
        </label>
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
        />
        <button
          disabled={busy || !name || !url}
          className="primary"
          onClick={() =>
            void save({
              ...profile,
              sources: [
                ...profile.sources,
                { id: crypto.randomUUID(), name, url, type, enabled: true },
              ],
            }).then((saved) => {
              if (saved) {
                setName("");
                setUrl("");
              }
            })
          }
        >
          Add source
        </button>
      </div>
    </details>
  );
}
function Story({
  article,
  disabled,
  toggle,
}: {
  article: Article;
  disabled: boolean;
  toggle: () => void;
}) {
  return (
    <article className={`story-card ${article.selected ? "selected" : ""}`}>
      <div className="story-top">
        <span className="eyebrow">{article.source}</span>
        <input
          aria-label={`Select ${article.title}`}
          type="checkbox"
          checked={article.selected}
          onChange={toggle}
          disabled={disabled}
        />
      </div>
      <h3>{article.title}</h3>
      <p>
        {article.excerpt || "No excerpt provided. Open the source to review."}
      </p>
      <div className="story-bottom">
        <span>
          {article.published
            ? new Date(article.published).toLocaleDateString()
            : "Date unknown"}{" "}
          · {article.coverage === "full" ? "Article text" : "Excerpt only"}
        </span>
        <button
          className="text-button"
          onClick={() => void api.invoke("openExternal", { url: article.url })}
        >
          Source ↗
        </button>
      </div>
    </article>
  );
}

function BlockEditor({
  block,
  index,
  count,
  image,
  change,
  regenerate,
  remove,
  move,
}: {
  block: Block;
  index: number;
  count: number;
  image?: string;
  change: (block: Block) => void;
  regenerate: (feedback: string) => void;
  remove: () => void;
  move: (delta: number) => void;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <article className="block-editor">
      <div className="block-heading">
        <span className="eyebrow">
          {String(index + 1).padStart(2, "0")} /{" "}
          {block.kind === "cta" ? "CALL TO ACTION" : block.kind.toUpperCase()}
        </span>
        <div className="button-row">
          <button
            disabled={index === 0}
            aria-label="Move block up"
            onClick={() => move(-1)}
          >
            ↑
          </button>
          <button
            disabled={index === count - 1}
            aria-label="Move block down"
            onClick={() => move(1)}
          >
            ↓
          </button>
          <button aria-label="Delete block" onClick={remove}>
            ×
          </button>
        </div>
      </div>
      {image && <img src={image} alt={block.alt} className="block-image" />}
      <Field
        label="Heading"
        value={block.title}
        onChange={(title) => change({ ...block, title })}
      />
      <Field
        label={
          block.kind === "event"
            ? "Event details, date, and location"
            : "Content"
        }
        value={block.body}
        multiline
        onChange={(body) => change({ ...block, body })}
      />
      {block.assetId ? (
        <Field
          label="Image description (alt text)"
          value={block.alt}
          onChange={(alt) => change({ ...block, alt })}
        />
      ) : null}
      <Field
        label="Link (optional)"
        value={block.url}
        onChange={(url) => change({ ...block, url })}
      />
      <details>
        <summary>Refine this block with AI</summary>
        <Field
          label="What should change?"
          value={feedback}
          onChange={setFeedback}
          placeholder="Shorter, friendlier, more practical…"
        />
        <button onClick={() => regenerate(feedback)}>
          ✦ Rewrite this block
        </button>
      </details>
    </article>
  );
}
function ImageComposer({
  busy,
  provider,
  generate,
}: {
  busy: boolean;
  provider: string;
  generate: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="tip-card">
      <span className="eyebrow">ADD SOME COLOR</span>
      <h3>A picture for your story.</h3>
      <Field
        label="Describe your image"
        value={prompt}
        onChange={setPrompt}
        multiline
        placeholder="A sunny community garden, soft editorial illustration…"
      />
      <button
        className="primary"
        disabled={busy || !prompt}
        onClick={() => generate(prompt)}
      >
        ✦ Generate image
      </button>
      <small>
        {provider === "local"
          ? "Created locally with ComfyUI"
          : "Sends this prompt to fal.ai"}
      </small>
    </div>
  );
}

function Preview({
  profile,
  issue,
  assets,
  busy,
  exportHtml,
  mailchimp,
}: {
  profile: Profile;
  issue: Issue;
  assets: Record<string, string>;
  busy: boolean;
  exportHtml: () => void;
  mailchimp: () => void;
}) {
  const [mode, setMode] = useState<"desktop" | "mobile" | "text">("desktop");
  const rendered = renderEmail(profile, issue, assets);
  return (
    <>
      <div className="preview-toolbar">
        <div className="segmented">
          {(["desktop", "mobile", "text"] as const).map((value) => (
            <button
              key={value}
              className={mode === value ? "selected" : ""}
              onClick={() => setMode(value)}
            >
              {value === "text"
                ? "Plain text"
                : value === "mobile"
                  ? "Mobile"
                  : "Desktop"}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button disabled={busy} onClick={exportHtml}>
            Export HTML
          </button>
          <button
            className="primary"
            disabled={busy || !issue.subject || !issue.blocks.length}
            onClick={mailchimp}
          >
            Create Mailchimp draft ↗
          </button>
        </div>
      </div>
      <div className="preview-caption">
        {issue.subject || "Add an email subject"}
        <span>{issue.preheader}</span>
      </div>
      <div className="preview-surface">
        {mode === "text" ? (
          <pre>{rendered.text}</pre>
        ) : (
          <iframe
            title="Newsletter preview"
            sandbox=""
            style={{ width: mode === "mobile" ? 390 : 760 }}
            srcDoc={rendered.html}
          />
        )}
      </div>
      <p className="privacy-note">
        Mailchimp handoff uploads this issue and its images. Review recipients
        and send in Mailchimp. Local HTML exports embed images; email services
        may require hosted images.
      </p>
    </>
  );
}

function SettingsEditor({
  library,
  busy,
  run,
  saved,
  restore,
  importComplete,
}: {
  library: Library;
  busy: boolean;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  saved: () => Promise<void>;
  restore: () => Promise<void>;
  importComplete: () => Promise<void>;
}) {
  const [value, setValue] = useState<Settings>(library.settings);
  const [models, setModels] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [keys, setKeys] = useState({ openrouter: "", fal: "", mailchimp: "" });
  const [supabase, setSupabase] = useState({
    url: "",
    key: "",
    preferenceId: "default-preferences",
  });
  const patch = (part: Partial<Settings>) => setValue({ ...value, ...part });
  async function connect(kind: "text" | "image") {
    await api.invoke("settings", value);
    const available = await api.invoke("models", { kind });
    if (kind === "text") {
      setModels(available);
      if (!value.textModel && available[0]) patch({ textModel: available[0] });
    } else {
      setImages(available);
      if (!value.imageModel && available[0])
        patch({ imageModel: available[0] });
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>Writing & images</h2>
        <p>Choose where generation happens. Local providers are the default.</p>
        <fieldset disabled={busy}>
          <label className="field">
            <span>Text generation</span>
            <select
              value={value.textProvider}
              onChange={(event) =>
                patch({
                  textProvider: event.target.value as Settings["textProvider"],
                  textModel: "",
                })
              }
            >
              <option value="local">Local · LM Studio</option>
              <option value="openrouter">Cloud · OpenRouter</option>
            </select>
          </label>
          {value.textProvider === "local" ? (
            <Field
              label="LM Studio URL"
              value={value.lmUrl}
              onChange={(lmUrl) => patch({ lmUrl })}
            />
          ) : (
            <p className="privacy-note">
              Selected source content and your prompts will be sent to
              OpenRouter when you generate.
            </p>
          )}
          <div className="field-pair">
            <Field
              label="Text model ID"
              value={value.textModel}
              onChange={(textModel) => patch({ textModel })}
            />
            <button onClick={() => void run(() => connect("text"))}>
              Connect & list models
            </button>
          </div>
          {models.length > 0 && (
            <select
              aria-label="Available text models"
              value={value.textModel}
              onChange={(event) => patch({ textModel: event.target.value })}
            >
              <option value="">Choose model</option>
              {models.map((model) => (
                <option key={model}>{model}</option>
              ))}
            </select>
          )}
          <Field
            label="Tested context limit (tokens)"
            value={String(value.contextTokens)}
            type="number"
            onChange={(limit) => patch({ contextTokens: Number(limit) })}
          />
          <hr />
          <label className="field">
            <span>Image generation</span>
            <select
              value={value.imageProvider}
              onChange={(event) =>
                patch({
                  imageProvider: event.target
                    .value as Settings["imageProvider"],
                })
              }
            >
              <option value="local">Local · ComfyUI</option>
              <option value="fal">Cloud · fal.ai</option>
            </select>
          </label>
          {value.imageProvider === "local" ? (
            <>
              <Field
                label="ComfyUI URL"
                value={value.comfyUrl}
                onChange={(comfyUrl) => patch({ comfyUrl })}
              />
              <div className="field-pair">
                <Field
                  label="Image checkpoint"
                  value={value.imageModel}
                  onChange={(imageModel) => patch({ imageModel })}
                />
                <button onClick={() => void run(() => connect("image"))}>
                  Connect & list models
                </button>
              </div>
              {images.length > 0 && (
                <select
                  aria-label="Available image models"
                  value={value.imageModel}
                  onChange={(event) =>
                    patch({ imageModel: event.target.value })
                  }
                >
                  <option value="">Choose checkpoint</option>
                  {images.map((model) => (
                    <option key={model}>{model}</option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <Field
              label="fal.ai model ID"
              value={value.falModel}
              onChange={(falModel) => patch({ falModel })}
            />
          )}
        </fieldset>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.invoke("settings", value);
              await saved();
            })
          }
        >
          Save settings
        </button>
      </section>
      <section className="panel">
        <h2>Connections</h2>
        <p>
          {library.secureCredentials
            ? "Credentials are encrypted using your operating system’s credential facilities."
            : "Secure credential storage is unavailable. Keys are kept for this session only."}
        </p>
        {(["openrouter", "fal", "mailchimp"] as const).map((name) => (
          <div className="credential-row" key={name}>
            <Field
              label={`${name === "fal" ? "fal.ai" : name === "openrouter" ? "OpenRouter" : "Mailchimp"} API key ${library.credentials.includes(name) ? "· saved" : ""}`}
              type="password"
              value={keys[name]}
              onChange={(key) => setKeys({ ...keys, [name]: key })}
            />
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.invoke("credential", { name, value: keys[name] });
                  setKeys({ ...keys, [name]: "" });
                  await saved();
                })
              }
            >
              {keys[name] ? "Save" : "Clear"}
            </button>
          </div>
        ))}
        <hr />
        <h3>Mailchimp draft handoff</h3>
        <Field
          label="Audience ID"
          value={value.mailchimpListId}
          onChange={(mailchimpListId) => patch({ mailchimpListId })}
        />
        <Field
          label="From name"
          value={value.fromName}
          onChange={(fromName) => patch({ fromName })}
        />
        <Field
          label="Reply-to email"
          value={value.replyTo}
          onChange={(replyTo) => patch({ replyTo })}
        />
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.invoke("settings", value);
              await saved();
            })
          }
        >
          Save Mailchimp settings
        </button>
        <p className="privacy-note">
          Creating a draft sends the newsletter and its images to your Mailchimp
          account. This app never sends a campaign.
        </p>
      </section>
      <section className="panel">
        <h2>Advanced prompts</h2>
        <Field
          label="Writing system prompt"
          value={value.systemPrompt}
          onChange={(systemPrompt) => patch({ systemPrompt })}
          multiline
        />
        <Field
          label="Writing instructions"
          value={value.taskPrompt}
          onChange={(taskPrompt) => patch({ taskPrompt })}
          multiline
        />
        <Field
          label="Image direction"
          value={value.imagePrompt}
          onChange={(imagePrompt) => patch({ imagePrompt })}
          multiline
        />
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api.invoke("settings", value);
              await saved();
            })
          }
        >
          Save prompts
        </button>
      </section>
      <section className="panel">
        <h2>Your data stays yours</h2>
        <p>
          Backups include newsletters, issues, settings, and images. They
          exclude API keys and Mailchimp export links.
        </p>
        <div className="button-row">
          <button
            disabled={busy}
            onClick={() => void run(() => api.invoke("backup", {}))}
          >
            Create backup
          </button>
          <button disabled={busy} onClick={() => void run(restore)}>
            Restore backup
          </button>
        </div>
        <hr />
        <details>
          <summary>Import your previous Supabase preferences</summary>
          <p>
            This is a read-only, one-time import. It adds your original
            newsletter brand and sources locally. Original model choices and
            prompt sets are preserved in your local backup without changing
            provider defaults.
          </p>
          <Field
            label="Supabase project URL"
            value={supabase.url}
            onChange={(url) => setSupabase({ ...supabase, url })}
          />
          <Field
            label="Supabase key (used only for this import)"
            type="password"
            value={supabase.key}
            onChange={(key) => setSupabase({ ...supabase, key })}
          />
          <Field
            label="Preference ID"
            value={supabase.preferenceId}
            onChange={(preferenceId) =>
              setSupabase({ ...supabase, preferenceId })
            }
          />
          <button
            disabled={busy || !supabase.key || !supabase.url}
            onClick={() =>
              void run(async () => {
                await api.invoke("importSupabase", supabase);
                setSupabase({ ...supabase, key: "" });
                await importComplete();
              })
            }
          >
            Import preferences
          </button>
        </details>
        <hr />
        <h3>Intentional connections</h3>
        <p>
          No app analytics, remote fonts, or automatic update checks. Sources
          are fetched when you gather. Local engine setup downloads files from
          their publishers. Third-party engine network behavior is documented
          separately.
        </p>
      </section>
    </div>
  );
}

function SetupPanel({
  status,
  busy,
  refresh,
  install,
  start,
  stop,
}: {
  status?: SetupStatus;
  busy: boolean;
  refresh: () => void;
  install: (engine: "text" | "image") => void;
  start: (engine: "text" | "image") => void;
  stop: (engine: "text" | "image") => void;
}) {
  const [accepted, setAccepted] = useState(false);
  return (
    <>
      <div className="setup-intro">
        <div className="setup-number">01</div>
        <div>
          <h2>A quick look at your computer</h2>
          <p>
            {status
              ? `${status.hardware.platform} / ${status.hardware.arch} · ${status.hardware.memoryGB} GB memory · ${status.hardware.freeDiskGB} GB free`
              : "Check your computer and local engine connections."}
          </p>
          <small>{status?.hardware.gpu}</small>
        </div>
        <button disabled={busy} onClick={refresh}>
          Check again
        </button>
      </div>
      <div className="engine-grid">
        {status?.engines.map((engine) => (
          <section className="panel engine-card" key={engine.id}>
            <span className="engine-symbol">
              {engine.id === "text" ? "Aa" : "◈"}
            </span>
            <span className={`pill ${engine.connected ? "" : "muted"}`}>
              {engine.connected
                ? "Connected"
                : engine.installed
                  ? "Installed"
                  : "Not set up"}
            </span>
            <h2>
              {engine.id === "text"
                ? "Write with LM Studio"
                : "Create with ComfyUI"}
            </h2>
            <p>{engine.details}</p>
            <ul>
              {status.downloads
                .filter((item) => item.id.startsWith(engine.id))
                .map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    <span>
                      {item.bytes
                        ? `${(item.bytes / 1024 ** 3).toFixed(2)} GB`
                        : "Size depends on platform"}
                    </span>
                    <button
                      className="text-button"
                      onClick={() =>
                        void api.invoke("openExternal", { url: item.termsUrl })
                      }
                    >
                      Publisher terms ↗
                    </button>
                  </li>
                ))}
            </ul>
            <div className="button-row">
              {engine.managed ? (
                <>
                  <button
                    disabled={busy || engine.connected}
                    className="primary"
                    onClick={() => start(engine.id)}
                  >
                    Start engine
                  </button>
                  <button disabled={busy} onClick={() => stop(engine.id)}>
                    Stop managed engine
                  </button>
                  <button
                    disabled={busy || !accepted}
                    onClick={() => install(engine.id)}
                  >
                    Repair setup
                  </button>
                </>
              ) : (
                <button
                  disabled={
                    busy ||
                    !accepted ||
                    !status.hardware.managedSupported ||
                    engine.connected
                  }
                  className="primary"
                  onClick={() => install(engine.id)}
                >
                  {engine.connected
                    ? "Using existing engine"
                    : "Install & set up"}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="panel setup-consent">
        <label>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />{" "}
          I have reviewed the publisher terms and want to download the engines
          and models for my own use.
        </label>
        <p>
          Allow at least 8 GB free for text setup and 20 GB for image setup.
          Downloads can be large. Setup installs isolated Python tooling and
          never changes GPU drivers. Existing engines are reused without
          replacing their settings. LM Studio maintains its own standard runtime
          data directory.
        </p>
        <p>
          You can write manually, upload images, and export newsletters while
          local AI is being set up.
        </p>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
