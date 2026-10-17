import { useState } from "react";
import { newBlock, type Block } from "@newsletter/core";
import { api, Dialog, Field, Icon, writingReady } from "./ui";
import type { Workspace } from "./workspace";

export function IssueEditor({
  workspace: w,
  activeBlock,
  activate,
}: {
  workspace: Workspace;
  activeBlock: string;
  activate: (id: string) => void;
}) {
  const issue = w.issue!;
  const [emailDetailsOpen, setEmailDetailsOpen] = useState(!issue.subject);
  const [confirmDraft, setConfirmDraft] = useState(false);
  const [rewrite, setRewrite] = useState<Block>();
  const [feedback, setFeedback] = useState("");
  const [sourceBlock, setSourceBlock] = useState<Block>();
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageDialog, setImageDialog] = useState(false);
  const selected = issue.articles.filter((article) => article.selected).length;
  const originals = issue.blocks.filter((block) => block.kind !== "story");
  // Before a text provider is configured, the AI actions lead to setup instead
  // of opening a dialog that cannot do anything.
  const ready = writingReady(w.library!);
  const setup = () => void w.navigate("settings");
  function draft() {
    if (
      issue.subject ||
      issue.preheader ||
      issue.intro ||
      issue.blocks.some((block) => block.kind === "story")
    )
      setConfirmDraft(true);
    else void w.act(() => w.generate());
  }
  function duplicate(block: Block) {
    const copy = { ...structuredClone(block), id: crypto.randomUUID() };
    const blocks = [...issue.blocks];
    blocks.splice(
      blocks.findIndex((item) => item.id === block.id) + 1,
      0,
      copy,
    );
    w.change({ ...issue, blocks }, true);
    activate(copy.id);
  }
  function move(index: number, offset: number) {
    const blocks = [...issue.blocks];
    [blocks[index], blocks[index + offset]] = [
      blocks[index + offset],
      blocks[index],
    ];
    w.change({ ...issue, blocks }, true);
  }
  return (
    <div className="issue-editor" aria-label="Issue editor">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">Edition</span>
          <h1>{issue.title}</h1>
        </div>
        {ready ? (
          <button
            className="primary"
            disabled={w.busy || (!selected && !issue.blocks.length)}
            onClick={draft}
          >
            <Icon name="edit" />
            Draft with AI
          </button>
        ) : (
          <button disabled={w.busy} onClick={setup}>
            <Icon name="edit" />
            Set up AI writing
          </button>
        )}
      </div>
      <p className="editor-context">
        {selected
          ? `${selected} sources selected`
          : "Write in your own words, or add a source to begin."}
      </p>
      <fieldset disabled={w.busy} className="editor-fields">
        <section
          className="paper-editor"
          aria-label="Email details and introduction"
        >
          <details
            className="email-details"
            open={emailDetailsOpen}
            onToggle={(event) => setEmailDetailsOpen(event.currentTarget.open)}
          >
            <summary>
              {issue.subject
                ? `Email details · ${issue.subject}`
                : "Email details · add a subject line"}
            </summary>
            <div className="paper-topline">
              <span className="eyebrow">The inbox first impression</span>
              <span className="subtle">Only your readers see these</span>
            </div>
            <Field
              label="Issue name"
              value={issue.title}
              onChange={(title) => w.change({ ...issue, title })}
            />
            <div className="subject-field">
              <Field
                label="Email subject"
                value={issue.subject}
                onChange={(subject) => w.change({ ...issue, subject })}
                placeholder="A reason to open this email"
              />
            </div>
            <Field
              label="Preview text"
              value={issue.preheader}
              onChange={(preheader) => w.change({ ...issue, preheader })}
              placeholder="The line that follows your subject in the inbox"
            />
          </details>
          <div className="editor-divider" />
          <div className="paper-topline">
            <span className="eyebrow">A note from you</span>
            <span className="subtle">Introduction</span>
          </div>
          <div className="intro-block">
            <Field
              label="Your introduction"
              value={issue.intro}
              onChange={(intro) => w.change({ ...issue, intro })}
              multiline
              placeholder="Hello, everyone…"
            />
          </div>
        </section>
        <div className="section-heading">
          <h2>
            In this edition
            <span className="count-badge">{issue.blocks.length}</span>
          </h2>
          <span>Your stories, in your order.</span>
        </div>
        {issue.blocks.map((block, index) => (
          <article
            key={block.id}
            id={`block-${block.id}`}
            tabIndex={0}
            aria-label={`${block.kind === "cta" ? "Call to action" : block.kind} block ${index + 1}`}
            className={`editor-block ${activeBlock === block.id ? "active-block" : ""}`}
            onFocus={() => activate(block.id)}
          >
            <div className="block-header">
              <span className="eyebrow">
                {String(index + 1).padStart(2, "0")} /{" "}
                {block.kind === "cta" ? "Call to action" : block.kind}
              </span>
              <div className="block-tools">
                <button
                  className="text-button"
                  title={ready ? undefined : "Choose a writing model first"}
                  onClick={() => {
                    if (!ready) return setup();
                    setRewrite(block);
                    setFeedback("");
                  }}
                >
                  <Icon name="edit" />
                  {ready ? "Rewrite" : "Set up AI rewriting"}
                </button>
                <button
                  className="icon-button"
                  aria-label="Move block up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <Icon name="up" />
                </button>
                <button
                  className="icon-button"
                  aria-label="Move block down"
                  disabled={index === issue.blocks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <Icon name="down" />
                </button>
                <button
                  className="icon-button"
                  aria-label="Duplicate block"
                  onClick={() => duplicate(block)}
                >
                  <Icon name="copy" />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete block"
                  onClick={() =>
                    w.change(
                      {
                        ...issue,
                        blocks: issue.blocks.filter(
                          (item) => item.id !== block.id,
                        ),
                      },
                      true,
                    )
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div className="block-content">
              <Field
                label="Heading"
                value={block.title}
                onChange={(title) => w.updateBlock({ ...block, title })}
                placeholder="Give this section a heading"
              />
              {block.assetId && w.assets[block.assetId] && (
                <img
                  className="block-image"
                  src={w.assets[block.assetId]}
                  alt={block.alt}
                />
              )}
              <Field
                label={
                  block.kind === "event"
                    ? "Event details, date, and location"
                    : "Content"
                }
                value={block.body}
                onChange={(body) => w.updateBlock({ ...block, body })}
                multiline
                placeholder="What would you like your readers to know?"
              />
              {block.assetId && (
                <Field
                  label="Image description (alt text)"
                  value={block.alt}
                  onChange={(alt) => w.updateBlock({ ...block, alt })}
                />
              )}
              <details className="block-link">
                <summary>
                  {block.url ? "Edit link" : "Add a link (optional)"}
                </summary>
                <Field
                  label="Link URL"
                  value={block.url}
                  onChange={(url) => w.updateBlock({ ...block, url })}
                />
              </details>
              {block.sourceIds.length > 0 && (
                <button
                  className="text-button source-reference"
                  onClick={() => setSourceBlock(block)}
                >
                  <Icon name="sources" />
                  Sources ({block.sourceIds.length})
                </button>
              )}
            </div>
          </article>
        ))}
        {!issue.blocks.length && (
          <div className="empty-small">
            A blank page is a good place to begin. Add your first block below.
          </div>
        )}
        <div className="add-block">
          <span>Add a block</span>
          <div className="button-row">
            {(["text", "event", "cta"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  const block = newBlock(kind);
                  w.change(
                    { ...issue, blocks: [...issue.blocks, block] },
                    true,
                  );
                  activate(block.id);
                }}
              >
                <Icon name="plus" />
                {kind === "cta"
                  ? "Call to action"
                  : kind === "event"
                    ? "Event"
                    : "Text"}
              </button>
            ))}
            <button onClick={() => setImageDialog(true)}>
              <Icon name="image" />
              Image
            </button>
          </div>
        </div>
      </fieldset>
      <div className="editor-footer">
        <span>{w.saveState}</span>
        <button disabled={w.busy} onClick={() => void w.navigate("preview")}>
          Preview issue <Icon name="arrow" />
        </button>
      </div>
      {confirmDraft && (
        <Dialog
          title="Replace the generated copy?"
          close={() => setConfirmDraft(false)}
        >
          <p>
            This will replace the subject, preview text, introduction, and{" "}
            {issue.blocks.filter((block) => block.kind === "story").length}{" "}
            story blocks using {selected} selected sources.
          </p>
          <p>
            <strong>
              {originals.length} original blocks stay in your issue.
            </strong>{" "}
            {originals.map((block) => block.title || block.kind).join(", ")}
          </p>
          <p>You can undo the replacement during this editing session.</p>
          <p className="privacy-note">
            {w.library!.settings.textProvider === "local"
              ? "Written locally with LM Studio."
              : "Selected sources and writing context will be sent to OpenRouter."}
          </p>
          <div className="dialog-actions">
            <button onClick={() => setConfirmDraft(false)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                setConfirmDraft(false);
                void w.act(() => w.generate());
              }}
            >
              Replace generated copy
            </button>
          </div>
        </Dialog>
      )}
      {rewrite && (
        <Dialog title="Refine this block" close={() => setRewrite(undefined)}>
          <p>{rewrite.title || "Untitled block"}</p>
          <div className="button-row">
            {["Shorter", "Warmer", "Clearer"].map((label) => (
              <button
                key={label}
                aria-pressed={feedback === label}
                onClick={() => setFeedback(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <Field
            label="What should change?"
            value={feedback}
            onChange={setFeedback}
            multiline
            placeholder="Tell the editor what you have in mind…"
          />
          <p className="muted">
            Only this block changes.{" "}
            {w.library!.settings.textProvider === "local"
              ? "Written with local LM Studio."
              : "This block and its source context will be sent to OpenRouter."}
          </p>
          <div className="dialog-actions">
            <button onClick={() => setRewrite(undefined)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                const id = rewrite.id;
                setRewrite(undefined);
                void w.act(() => w.generate(id, feedback));
              }}
            >
              Rewrite this block
            </button>
          </div>
        </Dialog>
      )}
      {sourceBlock && (
        <Dialog
          title="Sources for this block"
          close={() => setSourceBlock(undefined)}
        >
          {sourceBlock.sourceIds.map((id) => {
            const article = issue.articles.find((item) => item.id === id);
            return article ? (
              <section key={id} className="reference-article">
                <h3>{article.title}</h3>
                <p className="muted">
                  {article.source} ·{" "}
                  {article.published
                    ? new Date(article.published).toLocaleDateString()
                    : "Date unknown"}{" "}
                  ·{" "}
                  {article.coverage === "full"
                    ? "Article text"
                    : "Excerpt only"}
                </p>
                <details open={sourceBlock.sourceIds.length === 1}>
                  <summary>Read source text</summary>
                  <p className="article-text">
                    {article.content || article.excerpt}
                  </p>
                </details>
                <button
                  onClick={() =>
                    void api.invoke("openExternal", { url: article.url })
                  }
                >
                  Open original article
                </button>
              </section>
            ) : (
              <p key={id}>This source is no longer available in the issue.</p>
            );
          })}
        </Dialog>
      )}
      {imageDialog && (
        <Dialog title="Add an image" close={() => setImageDialog(false)}>
          <button
            onClick={() => {
              setImageDialog(false);
              void w.act(() => w.addImage());
            }}
          >
            Choose an image from this computer
          </button>
          <hr />
          <Field
            label="Describe your image"
            value={imagePrompt}
            onChange={setImagePrompt}
            multiline
            placeholder="A sunny community garden, soft editorial illustration…"
          />
          <p className="muted">
            {w.library!.settings.imageProvider === "local"
              ? "Generated locally with ComfyUI."
              : "This prompt will be sent to fal.ai."}
          </p>
          <div className="dialog-actions">
            <button onClick={() => setImageDialog(false)}>Cancel</button>
            <button
              className="primary"
              disabled={!imagePrompt.trim()}
              onClick={() => {
                setImageDialog(false);
                void w.act(() => w.addImage(imagePrompt));
              }}
            >
              Generate image
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
