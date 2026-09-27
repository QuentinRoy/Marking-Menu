import { z } from 'zod';
import { experimentName } from '../model.ts';

// The subset of a Lightmill log record the conversion needs.
export type StoredLog = {
  runName: string;
  runStatus: string;
  number: number;
  type: string;
  values: Record<string, unknown>;
};

export type CorpusFiles = {
  manifest: string;
  trials: string;
  events: string;
  skippedRuns: Array<{ runName: string; runStatus: string }>;
};

const sessionSchema = z.object({
  date: z.string(),
  sessionNumber: z.number(),
  device: z.string(),
  userAgent: z.string(),
  devicePixelRatio: z.number(),
});

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

const pointSchema = z.object({ x: z.number(), y: z.number() });

const trialSchema = z.object({
  date: z.string(),
  taskNumber: z.number(),
  trialId: z.string(),
  blockId: z.string(),
  breadth: z.number(),
  depth: z.number(),
  targetIndices: z.array(z.number()),
  targetAngles: z.array(z.number()),
  events: z.array(eventSchema),
  overlay: z.array(pointSchema),
  discarded: z.boolean(),
  // The log serializer turns an undefined label into null.
  label: z.enum(['accept', 'reject', 'unsure']).nullable(),
});

function csvValue(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value);
  return /[\n\r",]/v.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows: unknown[][]): string {
  return rows
    .map((row) => `${row.map((value) => csvValue(value)).join(',')}\n`)
    .join('');
}

export function toCorpus(
  logs: Iterable<StoredLog>,
  {
    heldOutSessions,
    collectorRevision,
    collectorTag,
  }: {
    heldOutSessions: number[];
    collectorRevision: string;
    collectorTag: string;
  },
): CorpusFiles {
  const runs = new Map<string, { runStatus: string; logs: StoredLog[] }>();
  for (const log of logs) {
    const run = runs.get(log.runName) ?? {
      runStatus: log.runStatus,
      logs: [],
    };
    run.logs.push(log);
    runs.set(log.runName, run);
  }

  const sessions = [];
  const skippedRuns = [];
  const trialRows: unknown[][] = [
    [
      'trial_id',
      'session_number',
      'block_id',
      'breadth',
      'depth',
      'item_angles',
      'target_indices',
      'target_angles',
      'label',
      'overlay',
      'discarded',
      'recorded_at',
    ],
  ];
  const eventRows: unknown[][] = [
    [
      'trial_id',
      'event_index',
      'type',
      'x',
      'y',
      't',
      'pointer_type',
      'pressure',
      'width',
      'height',
      'coalesced',
    ],
  ];

  for (const [runName, run] of runs) {
    if (run.runStatus !== 'completed') {
      skippedRuns.push({ runName, runStatus: run.runStatus });
      continue;
    }

    const ordered = run.logs.toSorted((a, b) => a.number - b.number);
    const sessionLog = ordered.find((log) => log.type === 'session');
    if (!sessionLog) {
      throw new Error(`Run ${runName} has no session log.`);
    }

    const session = sessionSchema.parse(sessionLog.values);
    const trials = ordered
      .filter((log) => log.type === 'trial')
      .map((log) => trialSchema.parse(log.values));
    const last = trials.at(-1);
    sessions.push({
      number: session.sessionNumber,
      split: heldOutSessions.includes(session.sessionNumber)
        ? 'held-out'
        : 'tuning',
      startedAt: session.date,
      completedAt: last?.date,
      device: session.device,
      devicePixelRatio: session.devicePixelRatio,
      userAgent: session.userAgent,
      trialCount: trials.length,
    });

    for (const trial of trials) {
      const itemAngles = Array.from(
        { length: trial.breadth },
        (_, index) => (index * 360) / trial.breadth,
      );
      trialRows.push([
        trial.trialId,
        session.sessionNumber,
        trial.blockId,
        trial.breadth,
        trial.depth,
        Array.from({ length: trial.depth }, () => itemAngles),
        trial.targetIndices,
        trial.targetAngles,
        trial.label ?? '',
        trial.overlay,
        trial.discarded,
        trial.date,
      ]);
      for (const [index, event] of trial.events.entries()) {
        eventRows.push([
          trial.trialId,
          index,
          event.type,
          event.x,
          event.y,
          event.t,
          event.pointerType,
          event.pressure,
          event.width,
          event.height,
          event.coalesced,
        ]);
      }
    }
  }

  const manifest = {
    version: experimentName,
    collectorRevision,
    collectorTag,
    heldOutSessions,
    posture: 'tablet portrait, flat on table, dominant index finger',
    coordinates:
      'CSS px, origin at drawing area top left, y down, degrees clockwise from right',
    sessions: sessions.toSorted((a, b) => a.number - b.number),
  };
  return {
    manifest: `${JSON.stringify(manifest, undefined, 2)}\n`,
    trials: csv(trialRows),
    events: csv(eventRows),
    skippedRuns,
  };
}
