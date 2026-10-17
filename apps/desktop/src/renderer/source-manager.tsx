import { useState } from "react";
import type { Profile } from "@newsletter/core";
import { Field, Icon } from "./ui";
export function SourceManager({
  profile,
  busy,
  save,
}: {
  profile: Profile;
  busy: boolean;
  save: (profile: Profile) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"rss" | "website" | "article">("rss");
  const [editingId, setEditingId] = useState("");
  return (
    <details className="panel source-manager" open={!profile.sources.length}>
      <summary>
        Your sources <span>{profile.sources.length} configured</span>
      </summary>
      <div className="source-list">
        {profile.sources.map((source) => (
          <div key={source.id}>
            <input
              aria-label={`Include ${source.name}`}
              type="checkbox"
              checked={source.enabled}
              disabled={busy}
              onChange={(event) =>
                void save({
                  ...profile,
                  sources: profile.sources.map((value) =>
                    value.id === source.id
                      ? { ...value, enabled: event.target.checked }
                      : value,
                  ),
                })
              }
            />
            <div>
              <strong>{source.name}</strong>
              <small>{source.url}</small>
            </div>
            <span className="pill muted">{source.type}</span>
            <button
              disabled={busy}
              aria-label={`Edit ${source.name}`}
              onClick={() => {
                setEditingId(source.id);
                setName(source.name);
                setUrl(source.url);
                setType(source.type);
              }}
            >
              Edit
            </button>
            <button
              disabled={busy}
              aria-label={`Remove ${source.name}`}
              onClick={() =>
                void save({
                  ...profile,
                  sources: profile.sources.filter(
                    (value) => value.id !== source.id,
                  ),
                })
              }
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
      <div className="source-form">
        <Field
          label="Source name"
          value={name}
          onChange={setName}
          placeholder="A publication you trust"
        />
        <label className="field">
          <span>Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="rss">RSS feed</option>
            <option value="website">Website</option>
            <option value="article">Article URL</option>
          </select>
        </label>
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://…"
        />
        <button
          disabled={busy || !name || !url}
          className="primary"
          onClick={() =>
            void save({
              ...profile,
              sources: editingId
                ? profile.sources.map((source) =>
                    source.id === editingId
                      ? { ...source, name, url, type }
                      : source,
                  )
                : [
                    ...profile.sources,
                    { id: crypto.randomUUID(), name, url, type, enabled: true },
                  ],
            }).then((saved) => {
              if (saved) {
                setName("");
                setUrl("");
                setEditingId("");
              }
            })
          }
        >
          {editingId ? "Save source" : "Add source"}
        </button>
        {editingId && (
          <button
            disabled={busy}
            onClick={() => {
              setEditingId("");
              setName("");
              setUrl("");
            }}
          >
            Cancel edit
          </button>
        )}
      </div>
    </details>
  );
}
