import { createDurableStore, DurableStorageAdapter } from '../mobile/src/utils/durableStore';

const key = 'test.durable';
const backupKey = `${key}.backup`;
type State = { entries: string[] };
const envelope = (revision: number, entries: string[]) => JSON.stringify({ version: 1, revision, data: { entries } });

function memoryAdapter() {
  const values = new Map<string, string>();
  const readFailures = new Set<string>();
  const writeFailures = new Set<string>();
  const adapter = {
    read: jest.fn(async (storageKey: string) => {
      if (readFailures.has(storageKey)) throw new Error('Storage unavailable');
      return values.get(storageKey) ?? null;
    }),
    write: jest.fn(async (storageKey: string, value: string) => {
      if (writeFailures.has(storageKey)) throw new Error('Storage write failed');
      values.set(storageKey, value);
    }),
  };
  return { values, readFailures, writeFailures, adapter };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

function sharedLock() {
  let tail = Promise.resolve();
  return <R,>(task: () => Promise<R>): Promise<R> => {
    const result = tail.then(task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

function isolatedFactory(): typeof createDurableStore {
  let factory!: typeof createDurableStore;
  jest.isolateModules(() => {
    factory = require('../mobile/src/utils/durableStore').createDurableStore;
  });
  return factory;
}

test('persists empty migration once, even across fresh instances', async () => {
  const memory = memoryAdapter();
  const migrate = jest.fn(async () => ({ entries: [] }));
  const store = createDurableStore({ key, adapters: [memory.adapter], migrate });
  expect(await store.read()).toEqual({ revision: 1, data: { entries: [] } });
  expect(JSON.parse(memory.values.get(key)!)).toEqual({ version: 1, revision: 1, data: { entries: [] } });
  const laterMigration = jest.fn(async () => ({ entries: ['legacy record'] }));
  const reopened = createDurableStore({ key, adapters: [memory.adapter], migrate: laterMigration });
  expect((await reopened.read()).data.entries).toEqual([]);
  expect(migrate).toHaveBeenCalledTimes(1);
  expect(laterMigration).not.toHaveBeenCalled();
});

test('serializes same-key instances while migration is delayed', async () => {
  const memory = memoryAdapter();
  const started = deferred<void>();
  const migration = deferred<State>();
  const migrate = jest.fn(() => { started.resolve(); return migration.promise; });
  const first = createDurableStore({ key, adapters: [memory.adapter], migrate });
  const second = createDurableStore({ key, adapters: [memory.adapter], migrate });
  const initialRead = first.read();
  await started.promise;
  const updater = jest.fn((data: State) => ({ entries: [...data.entries, 'new run'] }));
  const update = second.update(updater);
  expect(updater).not.toHaveBeenCalled();
  migration.resolve({ entries: ['migrated run'] });
  expect((await initialRead).revision).toBe(1);
  expect(await update).toEqual({ revision: 2, data: { entries: ['migrated run', 'new run'] } });
  expect(migrate).toHaveBeenCalledTimes(1);
});

test('cross-tab lock preserves concurrent additions from separate module contexts', async () => {
  const memory = memoryAdapter();
  memory.values.set(key, envelope(1, ['base']));
  const withLock = sharedLock();
  const options = { key, adapters: [memory.adapter], migrate: async () => ({ entries: [] as string[] }), withLock };
  const first = isolatedFactory()<State>(options);
  const second = isolatedFactory()<State>(options);
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    (index % 2 ? first : second).update(data => ({ entries: [...data.entries, `run-${index}`] })),
  ));
  expect(results.map(result => result.revision)).toEqual(Array.from({ length: 12 }, (_, index) => index + 2));
  expect((await first.read()).data.entries).toEqual(['base', ...Array.from({ length: 12 }, (_, index) => `run-${index}`)]);
});

test('does not resurrect a deletion or empty replacement from older mirrors and backups', async () => {
  const first = memoryAdapter();
  const second = memoryAdapter();
  first.values.set(key, envelope(5, []));
  first.values.set(backupKey, envelope(4, ['deleted run']));
  second.values.set(key, envelope(4, ['deleted run']));
  const migrate = jest.fn(async () => ({ entries: ['legacy run'] }));
  const store = createDurableStore({ key, adapters: [second.adapter, first.adapter], migrate });
  expect((await store.read()).data.entries).toEqual([]);
  expect(await store.update(data => ({ entries: [...data.entries, 'next run'] }))).toEqual({
    revision: 6, data: { entries: ['next run'] },
  });
  expect(migrate).not.toHaveBeenCalled();
});

test('recovers the highest valid revision including a newer backup', async () => {
  const memory = memoryAdapter();
  memory.values.set(key, envelope(2, ['old']));
  memory.values.set(backupKey, envelope(3, ['newer recovery']));
  const store = createDurableStore({ key, adapters: [memory.adapter], migrate: async () => ({ entries: [] }) });
  expect(await store.read()).toEqual({ revision: 3, data: { entries: ['newer recovery'] } });
  expect((await store.update(data => data)).revision).toBe(4);
  expect(JSON.parse(memory.values.get(backupKey)!).revision).toBe(3);
});

test('partial primary write failure still saves durably and the next update uses the newest mirror', async () => {
  const first = memoryAdapter();
  const second = memoryAdapter();
  first.values.set(key, envelope(1, ['base']));
  second.values.set(key, envelope(1, ['base']));
  first.writeFailures.add(key);
  const store = createDurableStore({ key, adapters: [first.adapter, second.adapter], migrate: async () => ({ entries: [] }) });
  expect((await store.update(data => ({ entries: [...data.entries, 'saved'] }))).revision).toBe(2);
  expect(JSON.parse(first.values.get(key)!).revision).toBe(1);
  expect((await store.read()).data.entries).toEqual(['base', 'saved']);
  first.writeFailures.clear();
  expect((await store.update(data => ({ entries: [...data.entries, 'next'] }))).data.entries).toEqual(['base', 'saved', 'next']);
  expect(first.values.get(key)).toBe(second.values.get(key));
});

test('all primary failures reject without publishing a new revision and do not poison the queue', async () => {
  const memory = memoryAdapter();
  memory.values.set(key, envelope(1, ['base']));
  memory.writeFailures.add(key);
  const store = createDurableStore({ key, adapters: [memory.adapter], migrate: async () => ({ entries: [] }) });
  await expect(store.update(() => ({ entries: ['unsaved'] }))).rejects.toThrow('any primary copy');
  expect(await store.read()).toEqual({ revision: 1, data: { entries: ['base'] } });
  memory.writeFailures.clear();
  expect(await store.update(() => ({ entries: ['saved'] }))).toEqual({ revision: 2, data: { entries: ['saved'] } });
});

test('backup writes finish before any primary write starts; backup failures do not discard a durable primary success', async () => {
  const memory = memoryAdapter();
  memory.values.set(key, envelope(1, ['base']));
  const backupStarted = deferred<void>();
  const finishBackup = deferred<void>();
  const adapter: DurableStorageAdapter = {
    read: memory.adapter.read,
    write: async (storageKey, value) => {
      if (storageKey === backupKey) {
        backupStarted.resolve();
        await finishBackup.promise;
        throw new Error('Backup unavailable');
      }
      await memory.adapter.write(storageKey, value);
    },
  };
  const store = createDurableStore({ key, adapters: [adapter], migrate: async () => ({ entries: [] }) });
  const updating = store.update(() => ({ entries: ['next'] }));
  await backupStarted.promise;
  expect(memory.adapter.write).not.toHaveBeenCalled();
  finishBackup.resolve();
  expect(await updating).toEqual({ revision: 2, data: { entries: ['next'] } });
});

test('corrupt primary recovers from a valid backup without rerunning migration', async () => {
  const memory = memoryAdapter();
  memory.values.set(key, '{damaged');
  memory.values.set(backupKey, envelope(7, ['recovered']));
  const migrate = jest.fn(async () => ({ entries: [] }));
  const store = createDurableStore({ key, adapters: [memory.adapter], migrate });
  expect(await store.read()).toEqual({ revision: 7, data: { entries: ['recovered'] } });
  expect(migrate).not.toHaveBeenCalled();
  expect((await store.update(data => data)).revision).toBe(8);
  expect(JSON.parse(memory.values.get(key)!).data.entries).toEqual(['recovered']);
});

test.each(['{damaged', '[]', '{"version":1,"revision":1}', '{"version":2,"revision":1,"data":{}}'])(
  'invalid nonempty data without a valid recovery copy blocks migration and writes: %s',
  async raw => {
    const memory = memoryAdapter();
    memory.values.set(key, raw);
    const migrate = jest.fn(async () => ({ entries: [] }));
    const updater = jest.fn((data: State) => data);
    const store = createDurableStore({ key, adapters: [memory.adapter], migrate });
    await expect(store.read()).rejects.toThrow('no valid recovery copy');
    await expect(store.update(updater)).rejects.toThrow('no valid recovery copy');
    expect(migrate).not.toHaveBeenCalled();
    expect(updater).not.toHaveBeenCalled();
    expect(memory.adapter.write).not.toHaveBeenCalled();
  },
);

test('any failed read prevents overwriting a potentially newer unknown copy', async () => {
  const available = memoryAdapter();
  const unavailable = memoryAdapter();
  available.values.set(key, envelope(2, ['known']));
  unavailable.values.set(key, envelope(3, ['unknown newer run']));
  unavailable.readFailures.add(key);
  const updater = jest.fn((data: State) => data);
  const migrate = jest.fn(async () => ({ entries: [] }));
  const store = createDurableStore({ key, adapters: [available.adapter, unavailable.adapter], migrate });
  await expect(store.update(updater)).rejects.toThrow('Could not read all copies');
  expect(updater).not.toHaveBeenCalled();
  expect(available.adapter.write).not.toHaveBeenCalled();
  expect(unavailable.adapter.write).not.toHaveBeenCalled();
  expect(migrate).not.toHaveBeenCalled();
});

test('returns clones and supplies fresh data; failed mutating updaters cannot change persistence', async () => {
  const memory = memoryAdapter();
  const migrationData = { entries: ['base'] };
  const store = createDurableStore({ key, adapters: [memory.adapter], migrate: async () => migrationData });
  const first = await store.read();
  first.data.entries.push('caller mutation');
  migrationData.entries.push('migration mutation');
  expect((await store.read()).data.entries).toEqual(['base']);
  await expect(store.update(data => {
    data.entries.push('failed mutation');
    throw new Error('Updater failed');
  })).rejects.toThrow('Updater failed');
  const saved = await store.update(data => { data.entries.push('saved'); return data; });
  saved.data.entries.push('later mutation');
  expect((await store.read()).data.entries).toEqual(['base', 'saved']);
});
