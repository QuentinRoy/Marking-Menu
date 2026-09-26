import type { RecordedTrial, Session } from './model.js';

function csvValue(value: unknown): string {
  const string = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${(string ?? '').replaceAll('"', '""')}"`;
}

function csv(rows: unknown[][]): string {
  return `${rows.map((row) => row.map(csvValue).join(',')).join('\n')}\n`;
}

export function exportSession(
  session: Session,
  trials: RecordedTrial[],
): Array<{ name: string; content: string }> {
  const recorded = trials.filter((trial) => !trial.plan.warmup);
  const manifest = {
    version: 'touch-v1',
    sessionId: session.id,
    sessionNumber: session.number,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    split: session.number === 4 ? 'held-out' : 'tuning',
    device: session.device,
    devicePixelRatio: session.devicePixelRatio,
    userAgent: session.userAgent,
    posture: 'tablet portrait, flat on table, dominant index finger',
    coordinates:
      'CSS px, origin at drawing area top left, y down, degrees clockwise from right',
  };
  const trialRows: unknown[][] = [
    [
      'trial_id',
      'session_id',
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
  for (const trial of recorded) {
    const { plan } = trial;
    const itemAngles = Array.from(
      { length: plan.breadth },
      (_, index) => (index * 360) / plan.breadth,
    );
    trialRows.push([
      trial.id,
      trial.sessionId,
      trial.blockId,
      plan.breadth,
      plan.depth,
      Array.from({ length: plan.depth }, () => itemAngles),
      plan.targetIndices,
      plan.targetAngles,
      trial.label ?? '',
      trial.overlay,
      trial.discarded,
      trial.recordedAt,
    ]);
    for (const [index, event] of trial.events.entries()) {
      eventRows.push([
        trial.id,
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

  return [
    {
      name: 'manifest.json',
      content: `${JSON.stringify(manifest, undefined, 2)}\n`,
    },
    { name: 'trials.csv', content: csv(trialRows) },
    { name: 'events.csv', content: csv(eventRows) },
  ];
}

export function download(fileName: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content]));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
