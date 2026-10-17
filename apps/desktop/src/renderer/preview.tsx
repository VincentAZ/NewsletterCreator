import { useEffect, useRef, useState } from "react";
import { renderEmail, type Issue, type Profile } from "@newsletter/core";
import type { Workspace } from "./workspace";
import { Icon } from "./ui";

export function EmailPreview({
  profile,
  issue,
  assets,
  compact = false,
}: {
  profile: Profile;
  issue: Issue;
  assets: Record<string, string>;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"desktop" | "mobile" | "text">(
    compact ? "mobile" : "desktop",
  );
  const [available, setAvailable] = useState(0);
  const [height, setHeight] = useState(1000);
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const contentObserver = useRef<ResizeObserver | null>(null);
  const rendered = renderEmail(profile, issue, assets);
  const width = mode === "mobile" ? 390 : 760;
  const scale = Math.min(1, available / width || 1);
  useEffect(() => {
    const element = container.current!;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      contentObserver.current?.disconnect();
    };
  }, []);
  return (
    <div className={`email-preview ${compact ? "compact-preview" : ""}`}>
      <div className="segmented" aria-label="Preview format">
        {(["desktop", "mobile", "text"] as const)
          .filter((value) => !compact || value !== "text")
          .map((value) => (
            <button
              key={value}
              aria-pressed={value === mode}
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
      <div className="preview-caption">
        <strong>{issue.subject || "Your email subject"}</strong>
        <span>{issue.preheader || "Preview text will appear here"}</span>
      </div>
      <div ref={container} className="preview-container">
        {mode === "text" ? (
          <pre>{rendered.text}</pre>
        ) : (
          <div
            className="preview-frame-space"
            style={{ height: height * scale, width: width * scale }}
          >
            <iframe
              ref={frame}
              title="Newsletter preview"
              sandbox="allow-same-origin"
              srcDoc={rendered.html}
              style={{
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              onLoad={() => {
                const doc = frame.current?.contentDocument;
                if (!doc) return;
                const measure = () => {
                  const email = doc.body.querySelector("table");
                  setHeight(
                    Math.max(500, email?.getBoundingClientRect().height || 0),
                  );
                };
                contentObserver.current?.disconnect();
                const email = doc.body.querySelector("table");
                contentObserver.current = new ResizeObserver(measure);
                if (email) contentObserver.current.observe(email);
                measure();
                for (const image of Array.from(doc.images))
                  image.addEventListener("load", measure, { once: true });
              }}
            />
          </div>
        )}
      </div>
      {compact && (
        <p className="muted preview-note">
          Live layout preview. Open Preview & Export for a full-size review.
        </p>
      )}
    </div>
  );
}
export function ExportView({ workspace: w }: { workspace: Workspace }) {
  return (
    <div className="export-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE FINAL READ</span>
          <h1>Ready for your readers.</h1>
        </div>
        <button onClick={() => void w.navigate("studio")} disabled={w.busy}>
          Back to writing
        </button>
      </div>
      <div className="export-actions">
        <button disabled={w.busy} onClick={() => void w.act(w.exportHtml)}>
          Export HTML
        </button>
        <button
          className="primary"
          disabled={w.busy || !w.issue?.subject || !w.issue?.blocks.length}
          onClick={() => void w.act(w.mailchimp)}
        >
          Create Mailchimp draft <Icon name="arrow" />
        </button>
      </div>
      <p className="privacy-note">
        HTML exports stay on your computer with embedded images. Mailchimp
        handoff uploads this issue and its images; review recipients and send in
        Mailchimp.
      </p>
      <EmailPreview profile={w.profile!} issue={w.issue!} assets={w.assets} />
    </div>
  );
}
