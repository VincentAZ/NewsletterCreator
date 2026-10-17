import type { ReactNode } from "react";
import type { Workspace } from "./workspace";
import { api, Icon } from "./ui";

export function monogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "N"
  );
}

export function Shell({
  workspace: w,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const studio = w.page === "studio" || w.page === "preview";
  const profiles = w.library?.profiles || [];
  const issues = w.library?.issues || [];
  const deskProfile =
    w.page === "library"
      ? profiles.find((profile) => profile.id === w.deskProfileId)
      : undefined;
  const settingsProfile =
    w.page === "newsletter"
      ? profiles.find((profile) => profile.id === w.profileId)
      : undefined;
  const failed = Boolean(w.saveFailure);
  const saveKind = failed
    ? "failed"
    : w.saveState === "Saving…"
      ? "saving"
      : w.saveState === "Unsaved changes"
        ? "pending"
        : "saved";
  const count = (profileId: string) =>
    issues.filter((issue) => issue.profileId === profileId).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>
            Newsletter<span className="brand-light">Creator</span>
          </span>
        </div>
        <nav aria-label="Main navigation">
          <div className="rail-label">Your workspace</div>
          <button
            className="nav-item"
            aria-current={
              w.page === "library" && !deskProfile ? "page" : undefined
            }
            disabled={w.busy}
            onClick={() => void w.act(() => w.showDesk())}
          >
            <Icon name="library" />
            <span>Writing desk</span>
          </button>
          {profiles.length > 0 && (
            <>
              <div className="rail-label">
                <span>Newsletters</span>
                <button
                  className="icon-button"
                  aria-label="New newsletter"
                  title="New newsletter"
                  disabled={w.busy}
                  onClick={() =>
                    void w.act(async () => {
                      await w.flush();
                      w.clearIssue();
                      w.setProfileId("");
                      w.setPage("newsletter");
                    })
                  }
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <div className="publication-list">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    className="publication-nav"
                    aria-current={
                      deskProfile?.id === profile.id ||
                      settingsProfile?.id === profile.id ||
                      (studio && w.profile?.id === profile.id)
                        ? "true"
                        : undefined
                    }
                    title={profile.name}
                    disabled={w.busy}
                    onClick={() => void w.act(() => w.showDesk(profile.id))}
                  >
                    <span
                      className="pub-avatar"
                      style={{ background: profile.brandColor }}
                      aria-hidden="true"
                    >
                      {monogram(profile.name)}
                    </span>
                    <span>
                      {profile.name}
                      <small>
                        {count(profile.id)}{" "}
                        {count(profile.id) === 1 ? "edition" : "editions"}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          {w.profile && (
            <button
              className="nav-item"
              aria-current={w.page === "newsletter" ? "page" : undefined}
              disabled={w.busy}
              title="Newsletter settings"
              onClick={() =>
                void w.act(async () => {
                  await w.flush();
                  w.setProfileId(w.profile!.id);
                  w.setPage("newsletter");
                })
              }
            >
              <Icon name="sources" />
              <span>Newsletter settings</span>
            </button>
          )}
          <button
            className="nav-item"
            title="AI & integrations"
            aria-current={
              w.page === "settings" || w.page === "setup" ? "page" : undefined
            }
            disabled={w.busy}
            onClick={() => void w.navigate("settings")}
          >
            <Icon name="settings" />
            <span>AI &amp; integrations</span>
          </button>
          <div className="sidebar-note">
            <span className="status-dot" />
            <span>
              Stored on this computer.
              <small>Nothing is sent unless you choose to.</small>
            </span>
          </div>
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
                data-state={saveKind}
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
        {failed && w.issue && (
          <div className="save-recovery" role="status">
            <span>
              <strong>Your latest edits are not saved.</strong>
              {w.saveFailure} The draft is still open here.
            </span>
            <button disabled={w.busy} onClick={() => void w.act(w.flush)}>
              Retry save
            </button>
            <button disabled={w.busy} onClick={() => void w.act(w.copyDraft)}>
              Copy draft as text
            </button>
            <button
              className="danger"
              disabled={w.busy}
              onClick={() => {
                if (
                  confirm(
                    "Discard the unsaved edits and reopen the saved version of this issue?",
                  )
                )
                  void w.act(w.discardAndReload);
              }}
            >
              Discard edits and reload
            </button>
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
