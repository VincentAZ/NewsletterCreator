import { useState } from "react";
import { newProfile, type Issue, type Profile } from "@newsletter/core";
import type { Workspace } from "./workspace";
import { api, Icon } from "./ui";
import { monogram } from "./shell";

export type Preset = "blank" | "community" | "business" | "ai";
export function profileFromPreset(preset: Preset): Profile {
  const profile = newProfile();
  if (preset === "community")
    return {
      ...profile,
      name: "Around the Neighborhood",
      topic: "Community news, local events, and neighbor stories",
      audience: "Local residents",
      tone: "Warm, welcoming, and helpful",
      freshnessDays: 14,
    };
  if (preset === "business")
    return {
      ...profile,
      name: "Inside the Business",
      topic: "Company updates, useful advice, and upcoming offers",
      audience: "Customers and prospective customers",
      tone: "Friendly and knowledgeable",
      freshnessDays: 30,
    };
  if (preset === "ai")
    return {
      ...profile,
      name: "The AI Edit",
      topic: "Artificial intelligence news and practical applications",
      audience: "Curious professionals",
      freshnessDays: 3,
    };
  return profile;
}

const VIEW_KEY = "newsletter.desk.view";
function storedView(): "cards" | "list" {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function LibraryView({
  workspace: w,
  create,
}: {
  workspace: Workspace;
  create: (preset: Preset) => void;
}) {
  const library = w.library!;
  const [view, setView] = useState<"cards" | "list">(storedView);
  const [query, setQuery] = useState("");
  const scoped = library.profiles.find(
    (profile) => profile.id === w.deskProfileId,
  );
  const profileOf = (issue: Issue) =>
    library.profiles.find((profile) => profile.id === issue.profileId);
  const issues = library.issues
    .filter((issue) => !scoped || issue.profileId === scoped.id)
    .filter((issue) =>
      `${issue.title} ${issue.subject} ${profileOf(issue)?.name || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const resume = issues[0];
  const resumeProfile = resume ? profileOf(resume) : undefined;
  // "New edition" belongs to the newsletter in view, else the one edited most recently.
  const target = scoped || resumeProfile || w.profile;
  const startIssue = (profile?: Profile) =>
    void w.act(() => w.createIssue(profile || target));
  function changeView(next: "cards" | "list") {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* per-viewer convenience only */
    }
  }
  const duplicate = (issue: Issue) =>
    void w.act(async () => {
      await w.flush();
      await w.openIssue(
        await api.invoke("saveIssue", {
          ...issue,
          id: crypto.randomUUID(),
          title: issue.title + " (copy)",
          revision: 0,
        }),
      );
      await w.reload();
    });
  const remove = (issue: Issue) => {
    if (confirm(`Delete “${issue.title}”?`))
      void w.act(async () => {
        await w.flush();
        await api.invoke("deleteIssue", { id: issue.id });
        if (w.latest.current?.id === issue.id) w.clearIssue();
        await w.reload();
      });
  };
  const actions = (issue: Issue) => (
    <div className="issue-actions">
      <button
        className="icon-button"
        aria-label={`Duplicate ${issue.title}`}
        title="Duplicate"
        disabled={w.busy}
        onClick={() => duplicate(issue)}
      >
        <Icon name="copy" />
      </button>
      <button
        className="icon-button"
        aria-label={`Delete ${issue.title}`}
        title="Delete"
        disabled={w.busy}
        onClick={() => remove(issue)}
      >
        <Icon name="close" />
      </button>
    </div>
  );
  const titleButton = (issue: Issue, meta: string) => (
    <button
      className="issue-title"
      disabled={w.busy}
      onClick={() => void w.act(() => w.openIssue(issue))}
    >
      <strong>{issue.title}</strong>
      <span>{meta}</span>
    </button>
  );

  if (!library.profiles.length)
    return (
      <div className="library-view">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Writing desk</span>
            <h1>A good newsletter starts here.</h1>
            <p>News, notes, and your own point of view.</p>
          </div>
        </div>
        <section className="welcome panel">
          <h2>Who will you write for?</h2>
          <p>
            Pick a direction, or start blank. Your first issue needs no AI and
            no account.
          </p>
          <div className="preset-grid">
            {(
              [
                [
                  "blank",
                  "Start from scratch",
                  "Your subject. Your audience. Your voice.",
                ],
                [
                  "community",
                  "Community",
                  "Local updates, events, and things that bring people together.",
                ],
                [
                  "business",
                  "Small business",
                  "Useful advice, announcements, and your next offer.",
                ],
                [
                  "ai",
                  "AI news",
                  "A considered take on technology and its practical uses.",
                ],
              ] as const
            ).map(([id, title, body]) => (
              <button
                key={id}
                className="preset-card"
                disabled={w.busy}
                onClick={() => create(id)}
              >
                <Icon name={id === "blank" ? "plus" : "sources"} />
                <strong>{title}</strong>
                <span>{body}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
          <button
            className="text-button"
            disabled={w.busy}
            onClick={() => create("blank")}
          >
            Create your first newsletter
          </button>
        </section>
      </div>
    );

  return (
    <div className="library-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {scoped ? "Newsletter" : "Writing desk"}
          </span>
          <h1>{scoped ? scoped.name : "Good things, worth sharing."}</h1>
          <p>
            {scoped
              ? scoped.topic || "A space for your perspective."
              : "Every newsletter and every edition, in one place."}
          </p>
        </div>
        <div className="button-row">
          {scoped && (
            <button
              disabled={w.busy}
              onClick={() => void w.act(() => w.selectNewsletter(scoped.id))}
            >
              Newsletter settings
            </button>
          )}
          <button
            className="primary"
            disabled={w.busy}
            title={target ? `New edition of ${target.name}` : undefined}
            onClick={() => (target ? startIssue() : create("blank"))}
          >
            <Icon name="plus" />
            {target ? "New edition" : "Create a newsletter"}
          </button>
        </div>
      </div>

      {resume && resumeProfile && (
        <section className="desk-hero" aria-label="Continue writing">
          <div className="hero-copy">
            <span className="eyebrow">Pick up where you left off</span>
            <h2>{resume.title}</h2>
            <p>
              {resume.subject ||
                "No subject line yet. A good one is a reason to open."}
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                disabled={w.busy}
                onClick={() => void w.act(() => w.openIssue(resume))}
              >
                <Icon name="studio" />
                Continue writing
              </button>
              <span>
                {resumeProfile.name} · {resume.blocks.length}{" "}
                {resume.blocks.length === 1 ? "block" : "blocks"} · Draft ·
                edited {shortDate(resume.updatedAt)}
              </span>
            </div>
          </div>
          <LetterArt />
        </section>
      )}

      <div className="section-heading">
        <h2>
          Editions
          <span className="count-badge">{issues.length}</span>
        </h2>
        <div className="heading-actions">
          <input
            type="search"
            aria-label="Find an edition"
            placeholder="Find an edition…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: 200 }}
          />
          <div className="view-toggle" role="group" aria-label="Edition view">
            <button
              aria-pressed={view === "cards"}
              onClick={() => changeView("cards")}
            >
              Cards
            </button>
            <button
              aria-pressed={view === "list"}
              onClick={() => changeView("list")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {!issues.length && (
        <div className="empty-small">
          {query
            ? "No editions match that search."
            : "No editions yet. Start one and it will appear here."}
        </div>
      )}

      {issues.length > 0 && view === "cards" && (
        <div className="edition-grid">
          {issues.map((issue, index) => {
            const profile = profileOf(issue);
            return (
              <article className="edition-card" key={issue.id}>
                <button
                  className={`edition-cover cover-${index % 3}`}
                  aria-label={`Open ${issue.title}`}
                  disabled={w.busy}
                  onClick={() => void w.act(() => w.openIssue(issue))}
                >
                  <div className="mini-letter">
                    <div className="mini-brand">{profile?.name}</div>
                    <div className="mini-rule" />
                    <h3>{issue.subject || issue.title}</h3>
                    <span />
                    <span />
                    <span className="short" />
                  </div>
                  <span className="draft-tag">Draft</span>
                </button>
                <div className="edition-info">
                  {titleButton(
                    issue,
                    `${scoped ? "" : (profile?.name || "") + " · "}${shortDate(issue.updatedAt)} · ${issue.blocks.length} ${issue.blocks.length === 1 ? "block" : "blocks"}`,
                  )}
                  {actions(issue)}
                </div>
              </article>
            );
          })}
          <button
            className="new-edition-card"
            disabled={w.busy}
            onClick={() => startIssue()}
          >
            <span>
              <Icon name="plus" size={24} />
            </span>
            <strong>Start a new edition</strong>
            <small>{target ? `for ${target.name}` : "Blank page"}</small>
          </button>
        </div>
      )}

      {issues.length > 0 && view === "list" && (
        <div className="issue-list">
          {issues.map((issue) => (
            <article className="issue-row" key={issue.id}>
              <Icon name="sources" />
              {titleButton(
                issue,
                `${scoped ? "" : (profileOf(issue)?.name || "") + " · "}${new Date(issue.updatedAt).toLocaleDateString()} · ${issue.blocks.length} ${issue.blocks.length === 1 ? "block" : "blocks"}`,
              )}
              <span className="pill">Draft</span>
              {actions(issue)}
            </article>
          ))}
        </div>
      )}

      {!scoped && (
        <>
          <div className="section-heading">
            <h2>
              Your newsletters
              <span className="count-badge">{library.profiles.length}</span>
            </h2>
            <button
              className="text-button"
              disabled={w.busy}
              onClick={() => create("blank")}
            >
              <Icon name="plus" size={16} />
              New newsletter
            </button>
          </div>
          <div className="profile-grid">
            {library.profiles.map((profile) => (
              <article className="profile-card" key={profile.id}>
                <div
                  className="profile-monogram"
                  style={{ background: profile.brandColor }}
                >
                  {monogram(profile.name)}
                </div>
                <h3>{profile.name}</h3>
                <p>{profile.topic || "A space for your perspective"}</p>
                <small>
                  {
                    library.issues.filter(
                      (issue) => issue.profileId === profile.id,
                    ).length
                  }{" "}
                  editions
                </small>
                <div className="button-row">
                  <button
                    disabled={w.busy}
                    onClick={() => void w.act(() => w.createIssue(profile))}
                  >
                    Start an issue
                  </button>
                  <button
                    className="text-button"
                    disabled={w.busy}
                    onClick={() => void w.act(() => w.showDesk(profile.id))}
                  >
                    Open desk
                  </button>
                  <button
                    className="text-button"
                    disabled={w.busy}
                    onClick={() =>
                      void w.act(() => w.selectNewsletter(profile.id))
                    }
                  >
                    Newsletter settings
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LetterArt() {
  return (
    <svg
      className="letter-art"
      viewBox="0 0 240 150"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M44 64 L120 18 L196 64 V132 H44 Z" fill="#ffffff" />
      <path d="M44 64 L120 110 L196 64" />
      <path d="M44 132 L98 94 M196 132 L142 94" />
      <rect x="78" y="36" width="84" height="58" rx="3" fill="#fdfdf9" />
      <path d="M92 54 H148 M92 66 H140 M92 78 H128" />
      <path
        d="M212 44 c-10 2 -16 10 -16 22 c8 -2 14 -10 16 -22 Z"
        fill="#e2e8d7"
      />
      <path
        d="M222 60 c-10 4 -14 14 -12 26 c8 -4 12 -14 12 -26 Z"
        fill="#e2e8d7"
      />
    </svg>
  );
}
