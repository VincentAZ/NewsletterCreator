import { newProfile, type Profile } from "@newsletter/core";
import type { Workspace } from "./workspace";
import { api, Icon } from "./ui";

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
export function LibraryView({
  workspace: w,
  create,
}: {
  workspace: Workspace;
  create: (preset: Preset) => void;
}) {
  const library = w.library!;
  return (
    <div className="library-view">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EDITORIAL HOME</span>
          <h1>A good newsletter starts here.</h1>
          <p>News, notes, and your own point of view.</p>
        </div>
        <button
          className="primary"
          disabled={w.busy}
          onClick={() => create("blank")}
        >
          <Icon name="plus" />
          Create a newsletter
        </button>
      </div>
      {!library.profiles.length && (
        <section className="welcome panel">
          <h2>Who will you write for?</h2>
          <p>
            Start with a direction. You can write your first issue without
            setting up AI.
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
      )}
      {library.profiles.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Your newsletters</h2>
            <span>{library.profiles.length} publications</span>
          </div>
          <div className="profile-grid">
            {library.profiles.map((profile) => (
              <article className="profile-card" key={profile.id}>
                <div
                  className="profile-monogram"
                  style={{ background: profile.brandColor }}
                >
                  {profile.name.slice(0, 1)}
                </div>
                <h3>{profile.name}</h3>
                <p>{profile.topic || "A space for your perspective"}</p>
                <small>
                  {
                    library.issues.filter(
                      (issue) => issue.profileId === profile.id,
                    ).length
                  }{" "}
                  issues
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
      <div className="section-heading">
        <h2>Recent issues</h2>
        <span>Pick up where you left off</span>
      </div>
      <div className="issue-list">
        {library.issues.length ? (
          library.issues.map((issue) => (
            <article className="issue-row" key={issue.id}>
              <Icon name="sources" />
              <button
                className="issue-title"
                disabled={w.busy}
                onClick={() => void w.act(() => w.openIssue(issue))}
              >
                <strong>{issue.title}</strong>
                <span>
                  {
                    library.profiles.find(
                      (profile) => profile.id === issue.profileId,
                    )?.name
                  }{" "}
                  · {new Date(issue.updatedAt).toLocaleDateString()}
                </span>
              </button>
              <span className="pill">Draft</span>
              <button
                className="icon-button"
                aria-label={`Duplicate ${issue.title}`}
                disabled={w.busy}
                onClick={() =>
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
                  })
                }
              >
                <Icon name="copy" />
              </button>
              <button
                className="icon-button"
                aria-label={`Delete ${issue.title}`}
                disabled={w.busy}
                onClick={() => {
                  if (confirm(`Delete “${issue.title}”?`))
                    void w.act(async () => {
                      await w.flush();
                      await api.invoke("deleteIssue", { id: issue.id });
                      if (w.latest.current?.id === issue.id) w.clearIssue();
                      await w.reload();
                    });
                }}
              >
                <Icon name="close" />
              </button>
            </article>
          ))
        ) : (
          <p className="empty-small">
            Your first issue starts with a blank page.
          </p>
        )}
      </div>
    </div>
  );
}
