import { useState } from "react";
import { newBlock, type Article } from "@newsletter/core";
import { api, Dialog, Icon } from "./ui";
import { SourceManager } from "./source-manager";
import type { Workspace } from "./workspace";

export function ArticleDialog({
  article,
  close,
}: {
  article: Article;
  close: () => void;
}) {
  return (
    <Dialog title={article.title} close={close} className="article-dialog">
      <div className="article-meta">
        <span>{article.source}</span>
        <span>
          {article.published
            ? new Date(article.published).toLocaleDateString()
            : "Date unknown"}
        </span>
        <span className="pill">
          {article.coverage === "full" ? "Article text" : "Excerpt only"}
        </span>
      </div>
      <p className="article-text">
        {article.content ||
          article.excerpt ||
          "No readable text was available. Open the original article to read it."}
      </p>
      <p className="muted">
        Retrieved {new Date(article.retrievedAt).toLocaleString()}
      </p>
      <button
        onClick={() => void api.invoke("openExternal", { url: article.url })}
      >
        Open original article <Icon name="arrow" />
      </button>
    </Dialog>
  );
}

export function SourcesPanel({
  workspace: w,
  goToBlock,
}: {
  workspace: Workspace;
  goToBlock: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [inspected, setInspected] = useState<Article>();
  const issue = w.issue!;
  const profile = w.profile!;
  const selected = issue.articles.filter((article) => article.selected).length;
  const articles = issue.articles.filter(
    (article) =>
      (!selectedOnly || article.selected) &&
      (!source || article.source === source) &&
      `${article.title} ${article.excerpt} ${article.source}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const failed = w.outcomes.filter((outcome) => outcome.error);
  function select(id: string, enabled: boolean) {
    w.change({
      ...issue,
      articles: issue.articles.map((article) =>
        article.id === id ? { ...article, selected: enabled } : article,
      ),
    });
  }
  function add(article: Article) {
    const existing = issue.blocks.find((block) =>
      block.sourceIds.includes(article.id),
    );
    if (existing) {
      goToBlock(existing.id);
      return;
    }
    const block = {
      ...newBlock("story"),
      title: article.title,
      body: article.excerpt,
      url: article.url,
      sourceIds: [article.id],
    };
    w.change({ ...issue, blocks: [...issue.blocks, block] }, true);
    goToBlock(block.id);
  }
  return (
    <div className="sources-panel">
      <div className="section-heading">
        <div>
          <h2>Sources</h2>
          <p>
            {selected} selected · {profile.freshnessDays}-day window
          </p>
        </div>
        <button
          disabled={w.busy || !profile.sources.some((source) => source.enabled)}
          onClick={() => void w.act(w.collect)}
        >
          Gather
        </button>
      </div>
      <SourceManager
        profile={profile}
        busy={w.busy}
        save={(value) => w.act(() => w.saveProfile(value))}
      />
      {w.outcomes.length > 0 && (
        <div
          className={`collection-result ${failed.length ? "warning" : ""}`}
          role="status"
        >
          <strong>
            {failed.length === w.outcomes.length
              ? "Collection failed"
              : failed.length
                ? "Some sources could not be read"
                : "Collection complete"}
          </strong>
          <p>
            {w.outcomes.length - failed.length} of {w.outcomes.length} sources
            succeeded ·{" "}
            {w.outcomes.reduce((n, outcome) => n + outcome.count, 0)} stories
            found
          </p>
          <details>
            <summary>Source details</summary>
            {w.outcomes.map((outcome, i) => (
              <p key={i}>
                <strong>{outcome.name}</strong>:{" "}
                {outcome.error || `${outcome.count} stories`}
              </p>
            ))}
          </details>
          {failed.length > 0 && (
            <button disabled={w.busy} onClick={() => void w.act(w.collect)}>
              Retry collection
            </button>
          )}
        </div>
      )}
      <label className="field">
        <span>Find stories</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, source, or excerpt"
        />
      </label>
      <label className="field">
        <span>Filter by source</span>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {[...new Set(issue.articles.map((article) => article.source))].map(
            (name) => (
              <option key={name}>{name}</option>
            ),
          )}
        </select>
      </label>
      <div className="segmented" aria-label="Story view">
        <button
          aria-pressed={!selectedOnly}
          onClick={() => setSelectedOnly(false)}
        >
          All ({issue.articles.length})
        </button>
        <button
          aria-pressed={selectedOnly}
          onClick={() => setSelectedOnly(true)}
        >
          Selected ({selected})
        </button>
      </div>
      {issue.articles.length > 0 && (
        <div className="button-row">
          <button
            className="text-button"
            disabled={w.busy}
            onClick={() =>
              w.change({
                ...issue,
                articles: issue.articles.map((article) => ({
                  ...article,
                  selected: true,
                })),
              })
            }
          >
            Select all
          </button>
          <button
            className="text-button"
            disabled={w.busy}
            onClick={() =>
              w.change({
                ...issue,
                articles: issue.articles.map((article) => ({
                  ...article,
                  selected: false,
                })),
              })
            }
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="story-list">
        {articles.map((article) => {
          const included = issue.blocks.some((block) =>
            block.sourceIds.includes(article.id),
          );
          return (
            <article className="story-card" key={article.id}>
              <div className="story-top">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={article.selected}
                    disabled={w.busy}
                    onChange={(e) => select(article.id, e.target.checked)}
                  />
                  <span className="sr-only">Select {article.title}</span>
                </label>
                <span>{article.source}</span>
              </div>
              <h3>{article.title}</h3>
              <div className="article-meta">
                <span>
                  {article.published
                    ? new Date(article.published).toLocaleDateString()
                    : "Date unknown"}
                </span>
                <span>
                  {article.coverage === "full"
                    ? "Article text"
                    : "Excerpt only"}
                </span>
              </div>
              <p className="story-excerpt">
                {article.excerpt ||
                  "Open the original article for more information."}
              </p>
              <div className="button-row">
                <button
                  className="text-button"
                  onClick={() => setInspected(article)}
                >
                  Read source
                </button>
                <button disabled={w.busy} onClick={() => add(article)}>
                  {included ? "Go to block" : "Add to issue"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!articles.length && (
        <p className="empty-small">
          {issue.articles.length
            ? "No stories match these filters."
            : "Add a feed, website, or article URL, then gather stories. You can also write your own content in the editor."}
        </p>
      )}
      {inspected && (
        <ArticleDialog
          article={inspected}
          close={() => setInspected(undefined)}
        />
      )}
    </div>
  );
}
