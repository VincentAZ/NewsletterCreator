import { useEffect, useState } from "react";
import { newProfile, type Profile } from "@newsletter/core";
import { api, Field } from "./ui";
export function ProfileEditor({
  profile,
  initial,
  busy: externalBusy,
  save,
  createIssue,
  remove,
}: {
  profile?: Profile;
  initial?: Profile;
  busy: boolean;
  save: (profile: Profile) => Promise<boolean>;
  createIssue: () => void;
  remove: (id: string) => void;
}) {
  const [value, setValue] = useState(profile || initial || newProfile());
  const [choosingLogo, setChoosingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const busy = externalBusy || choosingLogo;
  useEffect(() => {
    let active = true;
    setLogoPreview("");
    if (value.logoAssetId)
      void api
        .invoke("readAsset", { id: value.logoAssetId })
        .then((data) => {
          if (active) setLogoPreview(data);
        })
        .catch((error: Error) => {
          if (active) setLogoError(error.message);
        });
    return () => {
      active = false;
    };
  }, [value.logoAssetId]);
  useEffect(() => {
    if (profile) setValue(profile);
  }, [profile]);
  const patch = (values: Partial<Profile>) => setValue({ ...value, ...values });
  function preset(kind: string) {
    patch(
      kind === "ai"
        ? {
            name: "The AI Edit",
            topic: "Artificial intelligence news and practical applications",
            audience: "Curious professionals",
            freshnessDays: 3,
          }
        : kind === "community"
          ? {
              name: "Around the Neighborhood",
              topic: "Community news, local events, and neighbor stories",
              audience: "Local residents",
              tone: "Warm, welcoming, and helpful",
              freshnessDays: 14,
            }
          : {
              name: "Inside the Business",
              topic: "Company updates, useful advice, and upcoming offers",
              audience: "Customers and prospective customers",
              tone: "Friendly and knowledgeable",
              freshnessDays: 30,
            },
    );
  }
  return (
    <div className="form-layout">
      <section className="panel">
        <div className="section-heading">
          <h2>
            {profile ? "Newsletter identity" : "Meet your next newsletter"}
          </h2>
          <span>Your publication</span>
        </div>
        {!profile && (
          <div className="preset-row">
            <span>Start with a direction</span>
            <button onClick={() => preset("community")}>Community</button>
            <button onClick={() => preset("business")}>Small business</button>
            <button onClick={() => preset("ai")}>AI news</button>
          </div>
        )}
        <fieldset disabled={busy}>
          <Field
            label="Newsletter name"
            value={value.name}
            onChange={(name) => patch({ name })}
          />
          <details className="profile-options" open={Boolean(profile)}>
            <summary>Audience, voice & branding (optional)</summary>
            <Field
              label="What is it about?"
              value={value.topic}
              onChange={(topic) => patch({ topic })}
              multiline
              placeholder="A subject you know, a community you care about…"
            />
            <Field
              label="Who are you writing for?"
              value={value.audience}
              onChange={(audience) => patch({ audience })}
            />
            <div className="field-pair">
              <Field
                label="Voice and tone"
                value={value.tone}
                onChange={(tone) => patch({ tone })}
              />
              <Field
                label="Language"
                value={value.language}
                onChange={(language) => patch({ language })}
              />
            </div>
            <div className="field-pair">
              <Field
                label="Freshness window (days)"
                type="number"
                value={String(value.freshnessDays)}
                onChange={(days) => patch({ freshnessDays: Number(days) })}
              />
              <Field
                label="Brand color"
                type="color"
                value={value.brandColor}
                onChange={(brandColor) => patch({ brandColor })}
              />
            </div>
            <Field
              label="Organization"
              value={value.organization}
              onChange={(organization) => patch({ organization })}
            />
            <details>
              <summary>Brand logo (optional)</summary>
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt={value.logoAlt || "Selected newsletter logo"}
                  style={{
                    maxWidth: 240,
                    maxHeight: 120,
                    background: value.brandColor,
                    padding: 12,
                    marginTop: 12,
                  }}
                />
              )}
              <div className="button-row">
                <button
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setChoosingLogo(true);
                      setLogoError("");
                      try {
                        const result = await api.invoke("pickImage", {});
                        if (result) patch({ logoAssetId: result.assetId });
                      } catch (error) {
                        setLogoError(
                          error instanceof Error
                            ? error.message
                            : "Could not read the logo.",
                        );
                      } finally {
                        setChoosingLogo(false);
                      }
                    })()
                  }
                >
                  Choose logo
                </button>
                {value.logoAssetId && (
                  <button
                    disabled={busy}
                    onClick={() => patch({ logoAssetId: "" })}
                  >
                    Remove logo
                  </button>
                )}
              </div>
              <Field
                label="Logo description"
                value={value.logoAlt}
                onChange={(logoAlt) => patch({ logoAlt })}
              />
              {logoError && <p role="alert">{logoError}</p>}
            </details>
            <Field
              label="Footer / contact information"
              value={value.footer}
              onChange={(footer) => patch({ footer })}
              multiline
            />
            <div className="field-pair">
              <Field
                label="Optional call-to-action label"
                value={value.ctaLabel}
                onChange={(ctaLabel) => patch({ ctaLabel })}
              />
              <Field
                label="Call-to-action URL"
                value={value.ctaUrl}
                onChange={(ctaUrl) => patch({ ctaUrl })}
              />
            </div>
            <Field
              label="Optional call-to-action message"
              value={value.ctaBody}
              onChange={(ctaBody) => patch({ ctaBody })}
              multiline
            />
          </details>
        </fieldset>
        <div className="button-row">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void save(value)}
          >
            Save newsletter
          </button>
          {profile && (
            <button disabled={busy} onClick={createIssue}>
              Start an issue →
            </button>
          )}
          {profile && (
            <button
              disabled={busy}
              onClick={() =>
                void save({
                  ...value,
                  id: crypto.randomUUID(),
                  name: `${value.name} (copy)`,
                  revision: 0,
                  sources: value.sources.map((source) => ({
                    ...source,
                    id: crypto.randomUUID(),
                  })),
                })
              }
            >
              Duplicate newsletter
            </button>
          )}
          {profile && (
            <button
              className="danger text-button"
              disabled={busy}
              onClick={() =>
                confirm("Delete this newsletter? Remove its issues first.") &&
                remove(profile.id)
              }
            >
              Delete
            </button>
          )}
        </div>
      </section>
      <aside>
        <div className="tip-card">
          <span className="eyebrow">A SIMPLE START</span>
          <h3>Specific beats generic.</h3>
          <p>
            “Helpful advice for first-time gardeners in your town” gives your
            newsletter more direction than “gardening.”
          </p>
          <p>
            These settings guide AI suggestions. Your voice and decisions stay
            in charge.
          </p>
        </div>
      </aside>
    </div>
  );
}
