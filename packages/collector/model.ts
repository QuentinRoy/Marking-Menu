export const experimentName = 'touch-v1';

export type Label = 'accept' | 'reject' | 'unsure';
export type EventKind =
  'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

export type RecordedEvent = {
  type: EventKind;
  x: number;
  y: number;
  t: number;
  pointerType: string;
  pressure: number;
  width: number;
  height: number;
  coalesced: boolean;
};

export type Point = { x: number; y: number };

export type TrialTask = {
  type: 'trial';
  // 1-based position in the session's timeline. Resumption skips this many
  // tasks, so it must count every task, warm-ups included.
  taskNumber: number;
  trialId: string;
  blockId: string;
  blockNumber: number;
  blockCount: number;
  breadth: number;
  depth: number;
  targetIndices: number[];
  targetAngles: number[];
  warmup: boolean;
};

export type SessionLog = {
  type: 'session';
  taskNumber: 0;
  sessionNumber: number;
  device: string;
  userAgent: string;
  devicePixelRatio: number;
};

export type WarmupLog = {
  type: 'warmup';
  taskNumber: number;
  trialId: string;
};

export type TrialLog = {
  type: 'trial';
  taskNumber: number;
  trialId: string;
  blockId: string;
  breadth: number;
  depth: number;
  targetIndices: number[];
  targetAngles: number[];
  events: RecordedEvent[];
  overlay: Point[];
  discarded: boolean;
  label: Label | undefined;
};

export type CollectorLog = SessionLog | WarmupLog | TrialLog;

export const resumableLogTypes: Array<CollectorLog['type']> = [
  'session',
  'warmup',
  'trial',
];

export function runName(sessionNumber: number): string {
  return `session-${sessionNumber}`;
}

const breadths = [4, 8, 12, 16];
const depths = [1, 2, 3];
const warmupCount = 3;

// Mulberry32. Seeding by session number lets a resumed run rebuild the
// exact timeline it was interrupted in.
/* eslint-disable no-bitwise -- The generator works on 32-bit integers. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
/* eslint-enable no-bitwise */

function shuffled<T>(values: T[], random: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const next = Math.floor(random() * (index + 1));
    const current = copy[index];
    const replacement = copy[next];
    if (current === undefined || replacement === undefined) {
      throw new RangeError('Shuffle index out of bounds.');
    }

    copy[index] = replacement;
    copy[next] = current;
  }

  return copy;
}

function path(breadth: number, depth: number, ordinal: number): number[] {
  const first = ordinal % breadth;
  const result = [first];
  // At breadth 4, a two-item turn is opposite, not a second "other" class.
  const turnClasses = breadth === 4 ? 4 : 5;
  for (let level = 1; level < depth; level++) {
    const previous = result[level - 1];
    if (previous === undefined) {
      throw new RangeError('Target path index out of bounds.');
    }

    const turnClass =
      (Math.floor(ordinal / breadth) + first + (level - 1) * 2) % turnClasses;
    const turn =
      [0, 1, -1, breadth / 2][turnClass] ?? (previous % 2 === 0 ? 2 : -2);
    result.push((previous + turn + breadth) % breadth);
  }

  return result;
}

export function makeTimeline(sessionNumber: number): TrialTask[] {
  const random = seededRandom(sessionNumber);
  const cells = shuffled(
    breadths.flatMap((breadth) => depths.map((depth) => ({ breadth, depth }))),
    random,
  );
  const tasks: TrialTask[] = [];
  for (const [blockIndex, { breadth, depth }] of cells.entries()) {
    const blockId = `s${sessionNumber}-b${breadth}x${depth}`;
    const count =
      depth === 1 ? breadth * (sessionNumber % 2 === 0 ? 3 : 2) : 20;
    const targets = shuffled(
      Array.from({ length: count }, (_, index) =>
        path(breadth, depth, index + (sessionNumber - 1) * count),
      ),
      random,
    );
    const warmups = Array.from({ length: warmupCount }, (_, index) =>
      path(breadth, depth, index),
    );
    for (const [index, targetIndices] of [...warmups, ...targets].entries()) {
      tasks.push({
        type: 'trial',
        taskNumber: tasks.length + 1,
        trialId: `${blockId}-t${index + 1}`,
        blockId,
        blockNumber: blockIndex + 1,
        blockCount: cells.length,
        breadth,
        depth,
        targetIndices,
        targetAngles: targetIndices.map((item) => (item * 360) / breadth),
        warmup: index < warmupCount,
      });
    }
  }

  return tasks;
}
