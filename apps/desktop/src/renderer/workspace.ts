import { useCallback, useEffect, useRef, useState } from "react";
import {
  newBlock,
  newIssue,
  undoEdit,
  type UndoEdit,
  type Block,
  type Issue,
  type Profile,
  type Library,
  type Progress,
  type SetupStatus,
  type SourceOutcome,
} from "@newsletter/core";
import { api } from "./ui";
export type Page =
  "library" | "newsletter" | "studio" | "preview" | "settings" | "setup";
export function useWorkspace() {
  const [library, setLibrary] = useState<Library>();
  const [page, setPage] = useState<Page>("library");
  const [issue, setIssue] = useState<Issue>();
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [jobId, setJobId] = useState("");
  const [saveState, setSaveState] = useState("Saved on this computer");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<UndoEdit[]>([]);
  const [outcomes, setOutcomes] = useState<SourceOutcome[]>([]);
  const running = useRef(false);
  const [setup, setSetup] = useState<SetupStatus>();
  const latest = useRef<Issue | undefined>(undefined);
  const dirty = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revision = useRef(new Map<string, number>());
  const profile =
    library?.profiles.find(
      (candidate) => candidate.id === (issue?.profileId || profileId),
    ) || (page === "newsletter" ? undefined : library?.profiles[0]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);
  const reload = useCallback(async () => {
    const data = await api.invoke("library", {});
    setLibrary(data);
    for (const item of data.issues)
      revision.current.set(item.id, item.revision);
    return data;
  }, []);
  useEffect(() => {
    void reload().catch((error: Error) => setError(error.message));
    return api.onProgress(setProgress);
  }, [reload]);
  useEffect(() => {
    const ids = new Set(
      [
        profile?.logoAssetId,
        ...(issue?.blocks || []).map((block) => block.assetId),
      ].filter((id): id is string => Boolean(id)),
    );
    for (const id of ids)
      if (!assets[id])
        void api
          .invoke("readAsset", { id })
          .then((data) => setAssets((current) => ({ ...current, [id]: data })))
          .catch((error: Error) => setError(error.message));
  }, [issue, profile, assets]);

  async function flush() {
    clearTimeout(timer.current);
    if (saving.current) {
      await saving.current;
      if (dirty.current) return flush();
      return;
    }
    if (!dirty.current || !latest.current) return;
    saving.current = (async () => {
      while (dirty.current && latest.current) {
        const snapshot = latest.current;
        dirty.current = false;
        setSaveState("Saving…");
        try {
          const saved = await api.invoke("saveIssue", {
            ...snapshot,
            revision: revision.current.get(snapshot.id) ?? snapshot.revision,
          });
          revision.current.set(saved.id, saved.revision);
          if (latest.current?.id === saved.id) {
            latest.current = { ...latest.current, revision: saved.revision };
            setIssue(latest.current);
          }
          setLibrary((current) =>
            current
              ? {
                  ...current,
                  issues: [
                    saved,
                    ...current.issues.filter(
                      (candidate) => candidate.id !== saved.id,
                    ),
                  ],
                }
              : current,
          );
          setSaveState("Saved on this computer");
        } catch (error) {
          dirty.current = true;
          setSaveState("Not saved · retry before leaving");
          throw error;
        }
      }
    })();
    try {
      await saving.current;
    } finally {
      saving.current = null;
    }
  }
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        event.preventDefault();
        event.returnValue = "";
        void flush().catch(() => {});
      }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  });
  function change(next: Issue, remember = false) {
    if (remember && latest.current) {
      // Capture now: React may run the state updater after latest.current changes.
      const edit = {
        before: structuredClone(latest.current),
        after: structuredClone(next),
      };
      setUndo((history) => [...history.slice(-19), edit]);
    }
    latest.current = next;
    setIssue(next);
    dirty.current = true;
    setSaveState("Unsaved changes");
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void flush().catch((error: Error) => setError(error.message)),
      500,
    );
  }
  async function act(work: () => Promise<unknown>, message = "") {
    if (running.current) return false;
    running.current = true;
    setError("");
    setBusy(true);
    setProgress(undefined);
    setStatus(message);
    try {
      await work();
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      return false;
    } finally {
      running.current = false;
      setBusy(false);
      setJobId("");
    }
  }
  async function navigate(next: Page) {
    await act(async () => {
      await flush();
      setPage(next);
      if (next === "setup") setSetup(await api.invoke("setupStatus", {}));
    });
  }
  async function openIssue(item: Issue) {
    await flush();
    latest.current = item;
    revision.current.set(item.id, item.revision);
    setIssue(item);
    setProfileId(item.profileId);
    setUndo([]);
    setOutcomes([]);
    setPage("studio");
  }
  async function createIssue(selected = profile) {
    await flush();
    if (!selected) {
      setPage("newsletter");
      return;
    }
    await openIssue(
      await api.invoke(
        "saveIssue",
        newIssue(
          selected.id,
          `${selected.name} · ${new Date().toLocaleDateString()}`,
        ),
      ),
    );
    await reload();
  }
  async function saveProfile(value: Profile) {
    await flush();
    const saved = await api.invoke("saveProfile", value);
    if (latest.current && latest.current.profileId !== saved.id) {
      latest.current = undefined;
      setIssue(undefined);
      setUndo([]);
    }
    setProfileId(saved.id);
    await reload();
    setStatus("Newsletter settings saved.");
    return saved;
  }
  async function collect() {
    if (!profile) return;
    if (!latest.current) await createIssue(profile);
    await flush();
    const id = crypto.randomUUID();
    setJobId(id);
    const result = await api.invoke("gather", {
      jobId: id,
      issueId: latest.current!.id,
      profileId: profile.id,
    });
    setOutcomes(result.outcomes);
    const current = latest.current!;
    const existing = new Set(current.articles.map((article) => article.url));
    change({
      ...current,
      articles: [
        ...current.articles,
        ...result.articles.filter((article) => !existing.has(article.url)),
      ].slice(0, 300),
    });
    await flush();
    setPage("studio");
    setStatus(
      `Collected ${result.articles.length} stories. Choose what belongs in this issue.`,
    );
  }
  async function generate(blockId?: string, feedback = "") {
    if (!latest.current) return;
    await flush();
    const id = crypto.randomUUID();
    setJobId(id);
    const result = await api.invoke("generate", {
      jobId: id,
      issueId: latest.current.id,
      blockId,
      feedback,
    });
    const current = latest.current!;
    change(
      blockId
        ? {
            ...current,
            blocks: current.blocks.map((block) =>
              block.id === blockId
                ? { ...result.blocks[0], id: block.id }
                : block,
            ),
          }
        : {
            ...current,
            subject: result.subject,
            preheader: result.preheader,
            intro: result.intro,
            blocks: [
              ...current.blocks.filter((block) => block.kind !== "story"),
              ...result.blocks,
            ],
          },
      true,
    );
    await flush();
    setStatus(
      "Copy is ready for your review. Original content has been preserved.",
    );
  }
  async function addImage(prompt?: string) {
    if (!latest.current) return;
    const id = crypto.randomUUID();
    setJobId(id);
    const result = prompt
      ? await api.invoke("image", { jobId: id, prompt })
      : await api.invoke("pickImage", {});
    if (result)
      change(
        {
          ...latest.current,
          blocks: [
            ...latest.current.blocks,
            {
              ...newBlock("image"),
              assetId: result.assetId,
              alt: prompt || "Newsletter image",
            },
          ],
        },
        true,
      );
  }
  function updateBlock(block: Block) {
    if (latest.current)
      change({
        ...latest.current,
        blocks: latest.current.blocks.map((value) =>
          value.id === block.id ? block : value,
        ),
      });
  }

  function clearIssue() {
    latest.current = undefined;
    setIssue(undefined);
    setUndo([]);
    setOutcomes([]);
    dirty.current = false;
  }
  async function selectNewsletter(id: string) {
    await flush();
    clearIssue();
    setProfileId(id);
    setPage("newsletter");
  }
  async function exportHtml() {
    if (!latest.current) return;
    await flush();
    const path = await api.invoke("exportHtml", { issueId: latest.current.id });
    if (path) setStatus(`Exported to ${path}`);
  }
  async function mailchimp() {
    if (!latest.current) return;
    await flush();
    const id = crypto.randomUUID();
    setJobId(id);
    const result = await api.invoke("mailchimp", {
      jobId: id,
      issueId: latest.current.id,
    });
    setStatus(
      `Mailchimp draft ready: ${result.campaignId}. Review and send in Mailchimp.`,
    );
    await api.invoke("openExternal", { url: result.url });
  }
  function undoLast() {
    if (!latest.current || !undo.length || busy) return;
    change(undoEdit(latest.current, undo.at(-1)!));
    setUndo((history) => history.slice(0, -1));
  }
  return {
    library,
    page,
    issue,
    profileId,
    profile,
    status,
    error,
    busy,
    progress,
    jobId,
    saveState,
    assets,
    undo,
    outcomes,
    setup,
    latest,
    setPage,
    setProfileId,
    setStatus,
    setError,
    setSetup,
    reload,
    flush,
    change,
    act,
    navigate,
    openIssue,
    createIssue,
    saveProfile,
    collect,
    generate,
    addImage,
    updateBlock,
    clearIssue,
    selectNewsletter,
    exportHtml,
    mailchimp,
    undoLast,
    startJob: setJobId,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
