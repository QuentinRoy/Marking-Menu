import { z } from 'zod';
import type { RecordedTrial, Session } from './model.js';

const databaseName = 'marking-menu-touch-v1';
const eventSchema = z.object({
  type: z.enum(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']),
  x: z.number(),
  y: z.number(),
  t: z.number(),
  pointerType: z.string(),
  pressure: z.number(),
  width: z.number(),
  height: z.number(),
  coalesced: z.boolean(),
});
const planSchema = z.object({
  id: z.string(),
  blockId: z.string(),
  breadth: z.number(),
  depth: z.number(),
  targetIndices: z.array(z.number()),
  targetAngles: z.array(z.number()),
  warmup: z.boolean(),
});
const sessionSchema = z.object({
  id: z.string(),
  number: z.number(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  userAgent: z.string(),
  device: z.string(),
  devicePixelRatio: z.number(),
  nextIndex: z.number(),
  blocks: z.array(
    z.object({
      id: z.string(),
      breadth: z.number(),
      depth: z.number(),
      trials: z.array(planSchema),
    }),
  ),
});
const trialSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  blockId: z.string(),
  plan: planSchema,
  events: z.array(eventSchema),
  label: z.enum(['accept', 'reject', 'unsure']).optional(),
  overlay: z.array(z.object({ x: z.number(), y: z.number() })),
  discarded: z.boolean(),
  recordedAt: z.string(),
});

async function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener(
      'success',
      () => {
        resolve(request.result);
      },
      {
        once: true,
      },
    );
    request.addEventListener(
      'error',
      () => {
        reject(request.error ?? new Error('IndexedDB request failed.'));
      },
      {
        once: true,
      },
    );
  });
}

export async function openStore(): Promise<IDBDatabase> {
  const request = indexedDB.open(databaseName, 1);
  request.addEventListener('upgradeneeded', () => {
    const database = request.result;
    database.createObjectStore('sessions', { keyPath: 'id' });
    database
      .createObjectStore('trials', { keyPath: 'id' })
      .createIndex('sessionId', 'sessionId');
  });
  const database = await requestResult(request);
  if (typeof navigator.storage.persist === 'function') {
    await navigator.storage.persist();
  }

  return database;
}

export async function put<T>(
  database: IDBDatabase,
  store: string,
  value: T,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value);
    transaction.addEventListener(
      'complete',
      () => {
        resolve();
      },
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => {
        reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      },
      {
        once: true,
      },
    );
    transaction.addEventListener(
      'abort',
      () => {
        reject(
          transaction.error ?? new Error('IndexedDB transaction aborted.'),
        );
      },
      {
        once: true,
      },
    );
  });
}

export async function sessions(database: IDBDatabase): Promise<Session[]> {
  const saved: unknown = await requestResult(
    database.transaction('sessions').objectStore('sessions').getAll(),
  );
  return z.array(sessionSchema).parse(saved);
}

export async function trials(
  database: IDBDatabase,
  sessionId: string,
): Promise<RecordedTrial[]> {
  const saved: unknown = await requestResult(
    database
      .transaction('trials')
      .objectStore('trials')
      .index('sessionId')
      .getAll(sessionId),
  );
  return z.array(trialSchema).parse(saved);
}

export async function clearSession(
  database: IDBDatabase,
  sessionId: string,
): Promise<void> {
  const recorded = await trials(database, sessionId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ['sessions', 'trials'],
      'readwrite',
    );
    for (const trial of recorded) {
      transaction.objectStore('trials').delete(trial.id);
    }

    transaction.objectStore('sessions').delete(sessionId);
    transaction.addEventListener(
      'complete',
      () => {
        resolve();
      },
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => {
        reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      },
      {
        once: true,
      },
    );
    transaction.addEventListener(
      'abort',
      () => {
        reject(
          transaction.error ?? new Error('IndexedDB transaction aborted.'),
        );
      },
      {
        once: true,
      },
    );
  });
}
