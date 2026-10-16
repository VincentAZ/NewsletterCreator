import type { ReactNode } from "react";
import type { Workspace } from "./workspace";
import { api, Icon } from "./ui";

export function Shell({
  workspace: w,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const studio = w.page === "studio" || w.page === "preview";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>
            Newsletter
            <br />
            Creator
          </span>
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              ["library", "Library", "library"],
              ["studio", "Studio", "studio"],
              ["settings", "Settings", "settings"],
            ] as const
          ).map(([page, label, icon]) => (
            <button
              key={page}
              className="nav-item"
              aria-label={label}
              title={label}
              aria-current={
                w.page === page ||
                (page === "studio" && w.page === "preview") ||
                (page === "settings" && w.page === "setup")
                  ? "page"
                  : undefined
              }
              disabled={w.busy}
              onClick={() => void w.navigate(page)}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          Local by default
          <small>
            Stored on your computer.
            <br />
            Shared when you choose.
          </small>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="workspace-context">
            {w.profile ? (
              <details className="publication-menu">
                <summary title={w.profile.name}>{w.profile.name}</summary>
                <div className="publication-options">
                  <button
                    disabled={w.busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      void w.act(async () => {
                        await w.flush();
                        w.setProfileId(w.profile!.id);
                        w.setPage("newsletter");
                      });
                    }}
                  >
                    Newsletter settings
                  </button>
                  <button
                    disabled={w.busy}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      void w.act(() => w.createIssue());
                    }}
                  >
                    Start an issue
                  </button>
                </div>
              </details>
            ) : (
              <span>Your workspace</span>
            )}
            {studio && w.issue && (
              <>
                <span className="context-slash">/</span>
                <select
                  aria-label="Active issue"
                  value={w.issue.id}
                  disabled={w.busy}
                  onChange={(event) => {
                    const issue = w.library!.issues.find(
                      (item) => item.id === event.target.value,
                    );
                    if (issue) void w.act(() => w.openIssue(issue));
                  }}
                >
                  {w.library!.issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {w.issue && (
              <button
                className="save-status"
                disabled={w.busy}
                onClick={() => void w.act(w.flush)}
                aria-live="polite"
              >
                {w.saveState}
              </button>
            )}
            {studio && (
              <>
                <button
                  className="icon-button"
                  aria-label="Undo"
                  disabled={w.busy || !w.undo.length}
                  onClick={w.undoLast}
                >
                  <Icon name="undo" />
                </button>
                <button
                  className="primary"
                  disabled={w.busy || !w.issue}
                  onClick={() => void w.navigate("preview")}
                >
                  Preview & Export
                </button>
              </>
            )}
          </div>
        </header>
        {w.error && (
          <div className="notice error" role="alert">
            <div>
              <strong>Something needs attention</strong>
              <p>{w.error}</p>
            </div>
            <button onClick={() => w.setError("")}>Dismiss</button>
          </div>
        )}
        {w.busy && (
          <div className="notice progress" role="status">
            <span className="spinner" />
            <span>{w.progress?.message || w.status || "Working…"}</span>
            {w.progress?.total && (
              <progress
                value={w.progress.completed || 0}
                max={w.progress.total}
              />
            )}
            {w.jobId && (
              <button
                onClick={() => void api.invoke("cancel", { jobId: w.jobId })}
              >
                Cancel
              </button>
            )}
          </div>
        )}
        {!w.busy && w.status && (
          <div className="notice quiet" role="status">
            <span>{w.status}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => w.setStatus("")}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
