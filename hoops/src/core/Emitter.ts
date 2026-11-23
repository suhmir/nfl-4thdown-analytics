type Handler<T> = (payload: T) => void;

/** Minimal strongly-typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    (this.handlers[name] ??= []).push(fn);
    return () => {
      const list = this.handlers[name];
      if (list) this.handlers[name] = list.filter((h) => h !== fn);
    };
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    const list = this.handlers[name];
    if (list) for (const h of list) h(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}
