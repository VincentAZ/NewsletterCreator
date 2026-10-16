import { useState } from "react";
import {
  type Library,
  type Settings,
  type SetupStatus,
} from "@newsletter/core";
import { api, Field } from "./ui";
export function SettingsEditor({
  library,
  section,
  busy,
  run,
  saved,
  restore,
  importComplete,
}: {
  library: Library;
  section: "writing" | "mailchimp" | "data";
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
    <div className={`settings-grid settings-${section}`}>
      <section className="panel writing-panel">
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
      <section className="panel connections-panel">
        <h2>
          {section === "mailchimp"
            ? "Mailchimp connection"
            : "Optional cloud connections"}
        </h2>
        <p>
          {library.secureCredentials
            ? "Credentials are encrypted using your operating system’s credential facilities."
            : "Secure credential storage is unavailable. Keys are kept for this session only."}
        </p>
        {(["openrouter", "fal", "mailchimp"] as const)
          .filter((name) =>
            section === "mailchimp"
              ? name === "mailchimp"
              : name !== "mailchimp",
          )
          .map((name) => (
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
        {section === "mailchimp" && (
          <>
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
              Creating a draft sends the newsletter and its images to your
              Mailchimp account. This app never sends a campaign.
            </p>
          </>
        )}
      </section>
      <details className="panel prompts-panel">
        <summary>Advanced prompts</summary>
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
      </details>
      <section className="panel data-panel">
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
            newsletter brand, hosted logo, and sources locally. Original model
            choices and prompt sets are preserved in your local backup without
            changing provider defaults.
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

export function SetupPanel({
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
              : "Check your computer and local engine connections. Managed Apple Silicon setup requires macOS 14 or later."}
          </p>
          <small>{status?.hardware.gpu}</small>
          {status?.hardware.gpu.includes("CPU") && (
            <p>
              No supported GPU acceleration was detected. Manual writing and
              image uploads work normally. CPU image generation can be very
              slow; you can connect an existing compatible engine in Settings.
            </p>
          )}
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
          Allow at least 8 GB free for text setup and 30 GB for image setup.
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
