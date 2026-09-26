import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SQLiteDataStore } from '@lightmill/log-server';
import { experimentName } from '../model.ts';
import { toCorpus, type StoredLog } from './corpus.ts';
import { paths } from './paths.ts';

const { values } = parseArgs({
  options: {
    database: { type: 'string', default: paths.database },
    output: { type: 'string', default: paths.corpus },
    'held-out': { type: 'string', multiple: true, default: [] },
  },
});

const heldOutSessions = values['held-out'].map(Number);
if (
  heldOutSessions.length === 0 ||
  heldOutSessions.some((session) => Number.isNaN(session))
) {
  throw new TypeError('Name the held-out sessions, e.g. --held-out 4.');
}

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
// The manifest cites the collector revision, which must be the archival tag.
if (
  git('status', '--porcelain', '--', path.join(import.meta.dirname, '..')) !==
  ''
) {
  throw new Error('Commit the collector before exporting: its tree is dirty.');
}

const store = new SQLiteDataStore(values.database);
const logs: StoredLog[] = [];
try {
  for await (const log of store.getLogs({ experimentName })) {
    logs.push(log);
  }
} finally {
  await store.close();
}

const corpus = toCorpus(logs, {
  heldOutSessions,
  collectorRevision: git('rev-parse', 'HEAD'),
});
await mkdir(values.output, { recursive: true });
await Promise.all([
  writeFile(path.join(values.output, 'manifest.json'), corpus.manifest),
  writeFile(path.join(values.output, 'trials.csv'), corpus.trials),
  writeFile(path.join(values.output, 'events.csv'), corpus.events),
]);
for (const run of corpus.skippedRuns) {
  console.warn(`Skipped ${run.runName}: ${run.runStatus}, not completed.`);
}

console.log(`Exported to ${values.output}`);
