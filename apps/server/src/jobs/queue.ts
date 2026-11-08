type PendingTask = () => void;

/**
 * Cola FIFO con concurrencia acotada. Se encapsula para poder sustituirla
 * por una cola externa si el servicio escala a varias instancias.
 */
export class JobQueue {
  private active = 0;
  private readonly pending: PendingTask[] = [];

  constructor(private readonly concurrency = 2) {}

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.drain();
          });
      };
      if (this.active < this.concurrency) {
        run();
      } else {
        this.pending.push(run);
      }
    });
  }

  private drain(): void {
    if (this.active >= this.concurrency) return;
    const next = this.pending.shift();
    if (next) next();
  }

  async onIdle(): Promise<void> {
    while (this.active > 0 || this.pending.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}
