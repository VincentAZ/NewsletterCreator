/** One in-flight write, with pending snapshots coalesced to the most recent edit. */
export class SaveQueue<T, R> {
  private pending?: { value: T; waiters: Array<{ resolve: (result: R) => void; reject: (error: unknown) => void }> };
  private running = false;
  constructor(private readonly write: (value: T) => Promise<R>) {}

  enqueue(value: T): Promise<R> {
    return new Promise((resolve, reject) => {
      if (this.pending) {
        this.pending.value = value;
        this.pending.waiters.push({ resolve, reject });
      } else {
        this.pending = { value, waiters: [{ resolve, reject }] };
      }
      void this.drain();
    });
  }

  private rejectPending(error: unknown) {
    this.pending?.waiters.forEach(({ reject }) => reject(error));
    this.pending = undefined;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending) {
        const batch = this.pending;
        this.pending = undefined;
        try {
          const result = await this.write(batch.value);
          batch.waiters.forEach(({ resolve }) => resolve(result));
        } catch (error) {
          batch.waiters.forEach(({ reject }) => reject(error));
          // Do not write later snapshots against unknown/conflicted server state.
          this.rejectPending(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
