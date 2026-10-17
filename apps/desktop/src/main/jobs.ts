import type { Progress } from "@newsletter/core";

export class Jobs {
  private active = new Map<string, AbortController>();
  private inferenceTail: Promise<unknown> = Promise.resolve();
  private pending = new Set<Promise<void>>();
  constructor(private readonly notify: (value: Progress) => void) {}
  async run<T>(
    id: string,
    work: (
      signal: AbortSignal,
      report: (message: string, completed?: number, total?: number) => void,
    ) => Promise<T>,
    inference = false,
  ): Promise<T> {
    if (this.active.has(id))
      throw new Error("This operation is already running.");
    const controller = new AbortController();
    this.active.set(id, controller);
    let finish!: () => void;
    const settled = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.pending.add(settled);
    const report = (message: string, completed?: number, total?: number) =>
      this.notify({ jobId: id, stage: "working", message, completed, total });
    const execute = async () => {
      controller.signal.throwIfAborted();
      report("Working…");
      return work(controller.signal, report);
    };
    try {
      report(inference ? "Waiting to start…" : "Starting…");
      const result = inference
        ? this.inferenceTail.then(execute, execute)
        : execute();
      if (inference) this.inferenceTail = result.catch(() => {});
      const value = await result;
      this.notify({ jobId: id, stage: "complete", message: "Complete" });
      return value;
    } catch (error) {
      this.notify({
        jobId: id,
        stage: "error",
        message: controller.signal.aborted
          ? "Cancelled"
          : error instanceof Error
            ? error.message
            : "Operation failed",
      });
      throw error;
    } finally {
      this.active.delete(id);
      this.pending.delete(settled);
      finish();
    }
  }
  cancel(id: string) {
    this.active.get(id)?.abort(new Error("Cancelled"));
  }
  cancelAll() {
    for (const controller of this.active.values()) controller.abort();
  }
  async cancelAllAndWait() {
    this.cancelAll();
    await Promise.all(this.pending);
  }
}
