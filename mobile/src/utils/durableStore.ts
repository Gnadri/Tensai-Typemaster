export type DurableSnapshot<T> = { revision: number; data: T };

export type DurableStorageAdapter = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
};

export type DurableStoreOptions<T> = {
  key: string;
  adapters: DurableStorageAdapter[];
  migrate: () => Promise<T>;
  withLock?: <R>(task: () => Promise<R>) => Promise<R>;
};

export type DurableStore<T> = {
  read(): Promise<DurableSnapshot<T>>;
  update(updater: (data: T) => T): Promise<DurableSnapshot<T>>;
};

type StoredEnvelope<T> = DurableSnapshot<T> & { version: 1 };

// Serialize callers in this JS context even when they create separate instances.
// The supplied lock extends the same critical section across browser tabs.
const keyQueues = new Map<string, Promise<void>>();

function serializeForKey<R>(key: string, task: () => Promise<R>): Promise<R> {
  const previous = keyQueues.get(key) || Promise.resolve();
  const operation = previous.then(task);
  const settled = operation.then(() => undefined, () => undefined);
  keyQueues.set(key, settled);
  void settled.then(() => {
    if (keyQueues.get(key) === settled) keyQueues.delete(key);
  });
  return operation;
}

function cloneJson<T>(data: T): T {
  const serialized = JSON.stringify(data);
  if (serialized === undefined) throw new Error('Durable store data must be JSON serializable.');
  return JSON.parse(serialized);
}

function parseEnvelope<T>(raw: string): StoredEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      parsed.version === 1 && Number.isSafeInteger(parsed.revision) && parsed.revision >= 1 &&
      Object.prototype.hasOwnProperty.call(parsed, 'data')
    ) {
      return { version: 1, revision: parsed.revision, data: parsed.data };
    }
  } catch {
    // A valid mirror or backup may still recover the store.
  }
  return null;
}

export function createDurableStore<T>({ key, adapters, migrate, withLock }: DurableStoreOptions<T>): DurableStore<T> {
  if (!adapters.length) throw new Error('A durable store requires at least one storage adapter.');
  const backupKey = `${key}.backup`;
  const locked = <R,>(task: () => Promise<R>) =>
    serializeForKey(key, () => withLock ? withLock(task) : task());

  const inspect = async (): Promise<StoredEnvelope<T> | null> => {
    const reads = await Promise.allSettled(adapters.flatMap(adapter => [
      Promise.resolve().then(() => adapter.read(key)),
      Promise.resolve().then(() => adapter.read(backupKey)),
    ]));
    // An unread copy may contain a newer revision. Do not mutate from an
    // incomplete snapshot or mistake unavailable storage for an empty store.
    if (reads.some(result => result.status === 'rejected')) {
      throw new Error(`Could not read all copies of durable store "${key}". Nothing was written.`);
    }
    let newest: StoredEnvelope<T> | null = null;
    let hasInvalidData = false;
    for (const result of reads) {
      if (result.status !== 'fulfilled' || result.value == null || !result.value.trim()) continue;
      const envelope = parseEnvelope<T>(result.value);
      if (!envelope) hasInvalidData = true;
      else if (!newest || envelope.revision > newest.revision) newest = envelope;
    }
    if (!newest && hasInvalidData) {
      throw new Error(`Durable store "${key}" is damaged and has no valid recovery copy. Nothing was written.`);
    }
    return newest;
  };

  const write = async (envelope: StoredEnvelope<T>, previous?: StoredEnvelope<T>): Promise<DurableSnapshot<T>> => {
    const serialized = JSON.stringify(envelope);
    if (previous) {
      const backup = JSON.stringify(previous);
      await Promise.allSettled(adapters.map(adapter =>
        Promise.resolve().then(() => adapter.write(backupKey, backup)),
      ));
    }
    const writes = await Promise.allSettled(adapters.map(adapter =>
      Promise.resolve().then(() => adapter.write(key, serialized)),
    ));
    if (!writes.some(result => result.status === 'fulfilled')) {
      throw new Error(`Could not save durable store "${key}" to any primary copy.`);
    }
    return { revision: envelope.revision, data: cloneJson(envelope.data) };
  };

  const readCurrent = async (): Promise<StoredEnvelope<T>> => {
    const existing = await inspect();
    if (existing) return existing;
    const initial: StoredEnvelope<T> = { version: 1, revision: 1, data: cloneJson(await migrate()) };
    await write(initial);
    return initial;
  };

  return {
    read: () => locked(async () => {
      const current = await readCurrent();
      return { revision: current.revision, data: cloneJson(current.data) };
    }),
    update: updater => locked(async () => {
      const current = await readCurrent();
      if (current.revision === Number.MAX_SAFE_INTEGER) throw new Error('Durable store revision limit reached.');
      const data = cloneJson(updater(cloneJson(current.data)));
      return write({ version: 1, revision: current.revision + 1, data }, current);
    }),
  };
}
