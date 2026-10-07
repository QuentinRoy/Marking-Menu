import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SQLiteDataStore } from '@lightmill/log-server';
import {
  createClient,
  findResumableSessions,
  resumeSession,
  startSession,
  type Logger,
} from '../lightmill.ts';
import { experimentName, makeTimeline, type TrialTask } from '../model.ts';
import { backupDatabase } from '../server/backup.ts';
import { toCorpus, type StoredLog } from '../server/corpus.ts';
import { startServer } from '../server/server.ts';

const temporaryDirectory = () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'collector-'));
  return {
    directory,
    [Symbol.dispose]() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

// Node's fetch keeps no cookies, and a Lightmill session lives in one. Each
// jar is one browser; a new jar is a browser that lost its cookie.
const nodeFetch = globalThis.fetch;

const cookieJar = () => {
  let cookie = '';
  const jarFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    if (cookie !== '') {
      request.headers.set('cookie', cookie);
    }

    const response = await nodeFetch(request);
    const [received] = response.headers.getSetCookie();
    if (received !== undefined) {
      cookie = received.split(';', 1)[0] ?? '';
    }

    return response;
  };

  vi.stubGlobal('fetch', jarFetch);
  vi.stubGlobal('devicePixelRatio', 2);
  return {
    [Symbol.dispose]() {
      vi.unstubAllGlobals();
    },
  };
};

const logTask = async (logger: Logger, task: TrialTask) => {
  if (task.warmup) {
    await logger.addLog({
      type: 'warmup',
      taskNumber: task.taskNumber,
      trialId: task.trialId,
    });
    return;
  }

  await logger.addLog({
    type: 'trial',
    taskNumber: task.taskNumber,
    trialId: task.trialId,
    blockId: task.blockId,
    breadth: task.breadth,
    depth: task.depth,
    targetIndices: task.targetIndices,
    targetAngles: task.targetAngles,
    events: [
      {
        type: 'pointerdown',
        x: 1.5,
        y: 2,
        t: 10,
        pointerType: 'touch',
        pressure: 0.5,
        width: 20,
        height: 20,
        coalesced: false,
      },
      {
        type: 'pointerup',
        x: 80.25,
        y: 2,
        t: 200,
        pointerType: 'touch',
        pressure: 0,
        width: 20,
        height: 20,
        coalesced: false,
      },
    ],
    overlay: [
      { x: 1.5, y: 2 },
      { x: 80.25, y: 2 },
    ],
    discarded: false,
    label: 'accept',
  });
};

test('a session resumes after a server restart and exports as a corpus', async () => {
  using temporary = temporaryDirectory();
  using _browser = cookieJar();
  const databasePath = path.join(temporary.directory, 'touch-v1.sqlite');
  const timeline = makeTimeline(1);
  const [warmup1, warmup2, warmup3, trial4, trial5] = timeline;
  if (!warmup1 || !warmup2 || !warmup3 || !trial4 || !trial5) {
    throw new RangeError('The timeline is too short.');
  }

  {
    await using server = await startServer({
      databasePath,
      port: 0,
      host: '127.0.0.1',
    });
    const apiRoot = `${server.url}/api`;
    const client = createClient(apiRoot);
    await expect(findResumableSessions(client)).resolves.toEqual([]);
    const logger = await startSession(client, 1, 'Test tablet');
    for (const task of [warmup1, warmup2, warmup3, trial4]) {
      // Lightmill numbers logs in the order they arrive.
      // eslint-disable-next-line no-await-in-loop
      await logTask(logger, task);
    }
  }

  {
    await using server = await startServer({
      databasePath,
      port: 0,
      host: '127.0.0.1',
    });
    const apiRoot = `${server.url}/api`;
    const client = createClient(apiRoot);
    const [resumable, ...others] = await findResumableSessions(client);
    expect(others).toEqual([]);
    expect(resumable).toEqual({
      sessionNumber: 1,
      after: { number: 5 },
      completedTasks: 4,
    });
    if (!resumable) {
      throw new TypeError('No session to resume.');
    }

    const logger = await resumeSession(client, resumable);
    await logTask(logger, trial5);
    await logger.completeRun();
  }

  const backup = await backupDatabase(
    databasePath,
    path.join(temporary.directory, 'backups'),
  );
  expect(existsSync(backup)).toBe(true);
  expect(existsSync(`${backup}.session-key`)).toBe(true);

  const store = await SQLiteDataStore.open(backup);
  const logs: StoredLog[] = await Array.fromAsync(
    store.getLogs({ experimentName }),
  );

  await store.close();
  const corpus = toCorpus(logs, {
    heldOutSessions: [2],
    collectorRevision: 'abc123',
    collectorTag: 'touch-collector-v1',
  });
  expect(corpus.skippedRuns).toEqual([]);
  expect(JSON.parse(corpus.manifest)).toMatchObject({
    version: 'touch-v1',
    collectorRevision: 'abc123',
    collectorTag: 'touch-collector-v1',
    heldOutSessions: [2],
    sessions: [
      {
        number: 1,
        split: 'tuning',
        device: 'Test tablet',
        devicePixelRatio: 2,
        trialCount: 2,
      },
    ],
  });
  const trialLines = corpus.trials.trimEnd().split('\n');
  expect(trialLines).toHaveLength(3);
  expect(trialLines[1]).toMatch(new RegExp(`^${trial4.trialId},1,`, 'v'));
  expect(trialLines[2]).toMatch(new RegExp(`^${trial5.trialId},1,`, 'v'));
  expect(corpus.events.trimEnd().split('\n')).toEqual([
    'trial_id,event_index,type,x,y,t,pointer_type,pressure,width,height,coalesced',
    `${trial4.trialId},0,pointerdown,1.5,2,10,touch,0.5,20,20,false`,
    `${trial4.trialId},1,pointerup,80.25,2,200,touch,0,20,20,false`,
    `${trial5.trialId},0,pointerdown,1.5,2,10,touch,0.5,20,20,false`,
    `${trial5.trialId},1,pointerup,80.25,2,200,touch,0,20,20,false`,
  ]);
});

test('an unfinished session is left out of the corpus', async () => {
  using temporary = temporaryDirectory();
  const databasePath = path.join(temporary.directory, 'touch-v1.sqlite');
  await using server = await startServer({
    databasePath,
    port: 0,
    host: '127.0.0.1',
  });
  using _browser = cookieJar();
  const apiRoot = `${server.url}/api`;
  await startSession(createClient(apiRoot), 3, 'Test tablet');

  const store = await SQLiteDataStore.open(databasePath);
  const logs: StoredLog[] = await Array.fromAsync(
    store.getLogs({ experimentName }),
  );

  await store.close();
  const corpus = toCorpus(logs, {
    heldOutSessions: [],
    collectorRevision: '',
    collectorTag: '',
  });
  expect(corpus.skippedRuns).toEqual([
    { runName: 'session-3', runStatus: 'running' },
  ]);
  expect(JSON.parse(corpus.manifest)).toMatchObject({ sessions: [] });
});
