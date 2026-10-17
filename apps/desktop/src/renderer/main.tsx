import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Profile } from "@newsletter/core";
import { api, Empty } from "./ui";
import { useWorkspace } from "./workspace";
import { Shell } from "./shell";
import { LibraryView, profileFromPreset, type Preset } from "./library";
import { ProfileEditor } from "./profiles";
import { SettingsEditor, SetupPanel } from "./settings";
import { Studio } from "./studio";
import { ExportView } from "./preview";
import "./styles.css";

function App() {
  const w = useWorkspace();
  const [newProfile, setNewProfile] = useState<Profile>();
  const [settingsSection, setSettingsSection] = useState<
    "writing" | "mailchimp" | "data"
  >("writing");
  useEffect(() => {
    const undo = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey &&
        !element.closest("input, textarea, [contenteditable=true], dialog") &&
        w.page === "studio"
      ) {
        event.preventDefault();
        w.undoLast();
      }
    };
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  });
  function createNewsletter(preset: Preset) {
    void w.act(async () => {
      await w.flush();
      w.clearIssue();
      w.setProfileId("");
      setNewProfile(profileFromPreset(preset));
      w.setPage("newsletter");
    });
  }
  if (!w.library)
    return (
      <div className="loading">
        <span className="brand-mark">N</span>
        <h1>Opening your workspace</h1>
        <p>{w.error || "One moment…"}</p>
        {w.error && (
          <button onClick={() => void w.act(w.reload)}>
            Retry opening workspace
          </button>
        )}
      </div>
    );
  return (
    <Shell workspace={w}>
      {w.page === "library" && (
        <div className="page-scroll">
          <LibraryView workspace={w} create={createNewsletter} />
        </div>
      )}
      {w.page === "newsletter" && (
        <div className="page-scroll">
          <div className="page-heading">
            <div>
              <span className="eyebrow">Newsletter</span>
              <h1>
                {w.profileId ? "Newsletter settings" : "Name your newsletter."}
              </h1>
              <p>A name is enough to start. Everything else is optional.</p>
            </div>
          </div>
          <ProfileEditor
            key={w.profileId || newProfile?.id || "new"}
            profile={
              w.profileId
                ? w.library.profiles.find((item) => item.id === w.profileId)
                : undefined
            }
            initial={newProfile}
            busy={w.busy}
            save={(value) =>
              w.act(async () => {
                const saved = await w.saveProfile(value);
                w.setProfileId(saved.id);
                setNewProfile(undefined);
              })
            }
            createIssue={() => void w.act(() => w.createIssue())}
            remove={(id) =>
              void w.act(async () => {
                await w.flush();
                await api.invoke("deleteProfile", { id });
                w.clearIssue();
                w.setProfileId("");
                await w.reload();
                w.setPage("library");
              })
            }
          />
        </div>
      )}
      {w.issue && w.profile && (
        <div className="studio-mount" hidden={w.page !== "studio"}>
          <Studio workspace={w} />
        </div>
      )}
      {w.page === "studio" && !w.issue && (
        <Empty
          title="Your next issue is a blank canvas"
          body="Combine stories with your own updates, events, and ideas."
          action={() => void w.act(() => w.createIssue())}
          label="Start an issue"
        />
      )}
      {w.page === "preview" && w.issue && w.profile && (
        <div className="page-scroll">
          <ExportView workspace={w} />
        </div>
      )}
      {(w.page === "settings" || w.page === "setup") && (
        <div className="page-scroll settings-page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">Settings</span>
              <h1>AI &amp; integrations</h1>
              <p>
                Writing works without any of this. Connect local AI, a cloud
                provider, or Mailchimp when you want them.
              </p>
            </div>
          </div>
          <div className="settings-tabs" aria-label="Settings sections">
            {(
              [
                ["writing", "Writing & Images"],
                ["local", "Local AI Setup"],
                ["mailchimp", "Mailchimp"],
                ["data", "Data & Backups"],
              ] as const
            ).map(([section, label]) => (
              <button
                key={section}
                disabled={w.busy}
                aria-pressed={
                  section === "local"
                    ? w.page === "setup"
                    : w.page === "settings" && settingsSection === section
                }
                onClick={() => {
                  if (section === "local") void w.navigate("setup");
                  else {
                    setSettingsSection(section);
                    void w.navigate("settings");
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {w.page === "settings" && (
            <SettingsEditor
              key={JSON.stringify(w.library.settings)}
              section={settingsSection}
              library={w.library}
              busy={w.busy}
              run={w.act}
              saved={async () => {
                await w.reload();
                w.setStatus("Settings saved.");
              }}
              restore={async () => {
                await w.flush();
                if (await api.invoke("restore", {})) {
                  w.clearIssue();
                  w.setProfileId("");
                  await w.reload();
                  w.setStatus(
                    "Backup restored. Your previous data was backed up first.",
                  );
                }
              }}
              importComplete={async () => {
                await w.reload();
                w.setStatus(
                  "Preferences imported. The original Supabase data is unchanged.",
                );
              }}
            />
          )}
          {w.page === "setup" && (
            <SetupPanel
              status={w.setup}
              busy={w.busy}
              refresh={() =>
                void w.act(async () =>
                  w.setSetup(await api.invoke("setupStatus", {})),
                )
              }
              install={(engine) =>
                void w.act(async () => {
                  const id = crypto.randomUUID();
                  w.startJob(id);
                  w.setSetup(
                    await api.invoke("install", {
                      jobId: id,
                      engine,
                      acceptTerms: true,
                    }),
                  );
                  await w.reload();
                  w.setStatus(
                    "Setup finished. Check your model selection before generating.",
                  );
                })
              }
              start={(engine) =>
                void w.act(async () =>
                  w.setSetup(await api.invoke("startEngine", { engine })),
                )
              }
              stop={(engine) =>
                void w.act(async () =>
                  w.setSetup(await api.invoke("stopEngine", { engine })),
                )
              }
            />
          )}
        </div>
      )}
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
