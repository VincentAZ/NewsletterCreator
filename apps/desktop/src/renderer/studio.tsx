import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Workspace } from "./workspace";
import { Dialog, Icon } from "./ui";
import { IssueEditor } from "./editor";
import { SourcesPanel } from "./sources";
import { EmailPreview } from "./preview";

export function Studio({ workspace: w }: { workspace: Workspace }) {
  const [width, setWidth] = useState(window.innerWidth);
  const previousWidth = useRef(window.innerWidth);
  const [sources, setSources] = useState(false);
  const [preview, setPreview] = useState(window.innerWidth >= 1100);
  const [returnToPreview, setReturnToPreview] = useState(false);
  const [sourceWidth, setSourceWidth] = useState(320);
  const [previewWidth, setPreviewWidth] = useState(320);
  const [activeBlock, setActiveBlock] = useState("");
  const narrow = width < 1100;
  const panelLimit =
    width < 1600 ? Math.max(280, Math.min(400, width - 224 - 560 - 6)) : 400;
  const shownSourceWidth = Math.min(sourceWidth, panelLimit);
  const shownPreviewWidth = Math.min(previewWidth, panelLimit);
  useEffect(() => {
    const resize = () => {
      const nextWidth = window.innerWidth;
      if (nextWidth < 1100 && previousWidth.current >= 1100) {
        // Resizing must not unexpectedly open a modal over the writer's work.
        setSources(false);
        setPreview(false);
      }
      previousWidth.current = nextWidth;
      setWidth(nextWidth);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (width < 1600 && sources && preview) setPreview(false);
  }, [width, sources, preview]);
  function toggleSources() {
    if (!sources) setReturnToPreview(preview && !narrow && width < 1600);
    else if (returnToPreview && !narrow && width < 1600) setPreview(true);
    setSources(!sources);
    if (!sources && width < 1600) setPreview(false);
  }
  function togglePreview() {
    setPreview(!preview);
    if (!preview && width < 1600) setSources(false);
  }
  function goToBlock(id: string) {
    if (narrow) setSources(false);
    setActiveBlock(id);
    requestAnimationFrame(() => {
      const block = document.getElementById(`block-${id}`);
      block?.scrollIntoView({ behavior: "smooth", block: "center" });
      block?.focus({ preventScroll: true });
    });
  }
  function resizePanel(side: "left" | "right", value: number) {
    const other =
      side === "left"
        ? preview
          ? previewWidth + 6
          : 0
        : sources
          ? sourceWidth + 6
          : 0;
    const max = Math.min(400, width - 224 - 560 - other - 6);
    const next = Math.max(280, Math.min(max, value));
    if (side === "left") setSourceWidth(next);
    else setPreviewWidth(next);
  }
  const sourceContent = (
    <SourcesPanel key={w.issue!.id} workspace={w} goToBlock={goToBlock} />
  );
  const previewContent = (
    <>
      <div className="section-heading">
        <h2>Preview</h2>
        <button
          className="text-button"
          disabled={w.busy}
          onClick={() => {
            if (narrow) setPreview(false);
            void w.navigate("preview");
          }}
        >
          Open full size
        </button>
      </div>
      <EmailPreview
        profile={w.profile!}
        issue={w.issue!}
        assets={w.assets}
        compact
      />
    </>
  );
  return (
    <div className="studio">
      <div className="studio-toolbar">
        <div className="button-row">
          <button aria-pressed={sources} onClick={toggleSources}>
            <Icon name="sources" />
            Sources
          </button>
          <button aria-pressed={preview} onClick={togglePreview}>
            <Icon name="preview" />
            Preview
          </button>
        </div>
        <span className="muted">
          {w.issue!.blocks.length} blocks ·{" "}
          {w.library!.settings.textProvider === "local"
            ? "Local text AI selected"
            : "Cloud text AI selected"}
        </span>
      </div>
      <div className="studio-columns">
        {sources && !narrow && (
          <>
            <Panel width={shownSourceWidth} label="Source inbox">
              {sourceContent}
            </Panel>
            <ResizeHandle
              side="left"
              max={panelLimit}
              value={shownSourceWidth}
              resize={(value) => resizePanel("left", value)}
            />
          </>
        )}
        <div className="studio-editor-scroll">
          <IssueEditor
            key={w.issue!.id}
            workspace={w}
            activeBlock={activeBlock}
            activate={setActiveBlock}
          />
        </div>
        {preview && !narrow && (
          <>
            <ResizeHandle
              side="right"
              max={panelLimit}
              value={shownPreviewWidth}
              resize={(value) => resizePanel("right", value)}
            />
            <Panel width={shownPreviewWidth} label="Live email preview">
              {previewContent}
            </Panel>
          </>
        )}
      </div>
      {narrow && sources && (
        <Dialog
          title="Source inbox"
          className="drawer"
          close={() => setSources(false)}
        >
          {sourceContent}
        </Dialog>
      )}
      {narrow && preview && (
        <Dialog
          title="Live email preview"
          className="drawer"
          close={() => setPreview(false)}
        >
          {previewContent}
        </Dialog>
      )}
    </div>
  );
}
function Panel({
  width,
  label,
  children,
}: {
  width: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <aside aria-label={label} className="studio-panel" style={{ width }}>
      {children}
    </aside>
  );
}
function ResizeHandle({
  side,
  max,
  value,
  resize,
}: {
  side: "left" | "right";
  max: number;
  value: number;
  resize: (value: number) => void;
}) {
  return (
    <div
      className="resize-handle"
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${side === "left" ? "Sources" : "Preview"} panel`}
      aria-orientation="vertical"
      aria-valuemin={280}
      aria-valuemax={max}
      aria-valuenow={value}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        resize(
          event.key === "Home"
            ? 280
            : event.key === "End"
              ? 400
              : value +
                (event.key === "ArrowRight" ? 20 : -20) *
                  (side === "left" ? 1 : -1),
        );
      }}
      onPointerDown={(event) => {
        const start = event.clientX;
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) =>
          resize(value + (next.clientX - start) * (side === "left" ? 1 : -1));
        const stop = () => {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", stop);
          target.removeEventListener("pointercancel", stop);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", stop);
        target.addEventListener("pointercancel", stop);
      }}
    />
  );
}
