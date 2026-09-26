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

export type TrialPlan = {
  id: string;
  blockId: string;
  breadth: number;
  depth: number;
  targetIndices: number[];
  targetAngles: number[];
  warmup: boolean;
};

export type BlockPlan = {
  id: string;
  breadth: number;
  depth: number;
  trials: TrialPlan[];
};

export type Session = {
  id: string;
  number: number;
  startedAt: string;
  completedAt?: string | undefined;
  userAgent: string;
  device: string;
  devicePixelRatio: number;
  nextIndex: number;
  blocks: BlockPlan[];
};

export type RecordedTrial = {
  id: string;
  sessionId: string;
  blockId: string;
  plan: TrialPlan;
  events: RecordedEvent[];
  label?: Label | undefined;
  overlay: Array<{ x: number; y: number }>;
  discarded: boolean;
  recordedAt: string;
};

const breadths = [4, 8, 12, 16];
const turns = [0, 1, -1, 'opposite', 2, -2] as const;

function shuffled<T>(values: T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const next = Math.floor(Math.random() * (index + 1));
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
  for (let level = 1; level < depth; level++) {
    const turn =
      turns[Math.floor(ordinal / breadth + level - 1) % turns.length];
    const previous = result[level - 1];
    if (turn === undefined || previous === undefined) {
      throw new RangeError('Target path index out of bounds.');
    }

    const offset = turn === 'opposite' ? breadth / 2 : turn;
    result.push((previous + offset + breadth) % breadth);
  }

  return result;
}

export function makeSession(number: number, device: string): Session {
  const id = crypto.randomUUID();
  const blocks = shuffled(
    breadths.flatMap((breadth) =>
      [1, 2, 3].map((depth): BlockPlan => {
        const blockId = `${id}-${breadth}-${depth}`;
        const count = depth === 1 ? breadth * (number % 2 === 0 ? 3 : 2) : 20;
        const targets = shuffled(
          Array.from({ length: count }, (_, index) =>
            path(breadth, depth, index + (number - 1) * count),
          ),
        );
        const warmups = Array.from({ length: 3 }, (_, index) =>
          path(breadth, depth, index),
        );
        const trials = [...warmups, ...targets].map(
          (targetIndices, index): TrialPlan => ({
            id: crypto.randomUUID(),
            blockId,
            breadth,
            depth,
            targetIndices,
            targetAngles: targetIndices.map((item) => (item * 360) / breadth),
            warmup: index < warmups.length,
          }),
        );
        return { id: blockId, breadth, depth, trials };
      }),
    ),
  );
  return {
    id,
    number,
    startedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    device,
    devicePixelRatio: window.devicePixelRatio,
    nextIndex: 0,
    blocks,
  };
}

export function flattenTrials(session: Session): TrialPlan[] {
  return session.blocks.flatMap((block) => block.trials);
}

export function nextTrial(session: Session): TrialPlan | undefined {
  return flattenTrials(session)[session.nextIndex];
}
