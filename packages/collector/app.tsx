import { useEffect, useRef, useState } from 'react';
import { download, exportSession } from './export.js';
import {
  flattenTrials,
  makeSession,
  nextTrial,
  type EventKind,
  type RecordedEvent,
  type RecordedTrial,
  type Session,
  type TrialPlan,
} from './model.js';
import { fitOverlay, strokeLength } from './overlay.js';
import { clearSession, openStore, put, sessions, trials } from './storage.js';

type Point = { x: number; y: number };

function trace(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
}

function targetDiagram(angles: number[]): Point[] {
  const start = { x: 68, y: 55 };
  const points = [start];
  for (const angle of angles) {
    const last = points.at(-1);
    if (!last) {
      break;
    }
    points.push({
      x: last.x + Math.cos((angle * Math.PI) / 180) * 33,
      y: last.y + Math.sin((angle * Math.PI) / 180) * 33,
    });
  }

  return points;
}

function record(
  event: PointerEvent,
  type: EventKind,
  bounds: DOMRect,
  coalesced = false,
): RecordedEvent {
  return {
    type,
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
    t: event.timeStamp,
    pointerType: event.pointerType,
    pressure: event.pressure,
    width: event.width,
    height: event.height,
    coalesced,
  };
}

export function App() {
  const [database, setDatabase] = useState<IDBDatabase>();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [session, setSession] = useState<Session>();
  const [pending, setPending] = useState<RecordedTrial>();
  const [ink, setInk] = useState<RecordedEvent[]>([]);
  const [device, setDevice] = useState('');
  const [error, setError] = useState('');
  const drawing = useRef<
    { pointerId: number; events: RecordedEvent[] } | undefined
  >(undefined);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isActive = true;
    openStore()
      .then(async (store) => {
        const saved = await sessions(store);
        if (!isActive) {
          return;
        }
        setDatabase(store);
        setAllSessions(saved.sort((a, b) => a.number - b.number));
        const unfinished = saved.find((entry) => !entry.completedAt);
        if (unfinished) {
          setSession(unfinished);
          const stored = await trials(store, unfinished.id);
          if (!isActive) {
            return;
          }
          setPending(
            stored.find(
              (entry) => !entry.plan.warmup && !entry.label && !entry.discarded,
            ),
          );
        }
      })
      .catch((error_: unknown) => {
        setError(String(error_));
      });
    return () => {
      isActive = false;
    };
  }, []);

  const plan = session ? nextTrial(session) : undefined;
  const total = session ? flattenTrials(session).length : 0;
  const display = pending?.plan ?? plan;
  const block = display
    ? session?.blocks.find((entry) => entry.id === display.blockId)
    : undefined;
  const raw = pending?.events ?? ink;
  const points = raw
    .filter((event) => !event.coalesced)
    .map(({ x, y }) => ({ x, y }));

  async function startSession() {
    if (!database || !device.trim()) {
      return;
    }
    const created = makeSession(allSessions.length + 1, device.trim());
    try {
      await put(database, 'sessions', created);
      setAllSessions([...allSessions, created]);
      setSession(created);
      setPending(undefined);
    } catch (error_) {
      setError(String(error_));
    }
  }

  async function advance(current: Session, completed?: RecordedTrial) {
    if (!database) {
      return;
    }
    const updated = { ...current, nextIndex: current.nextIndex + 1 };
    if (updated.nextIndex >= total) {
      updated.completedAt = new Date().toISOString();
    }

    if (completed) {
      await put(database, 'trials', completed);
    }
    await put(database, 'sessions', updated);
    setSession(updated);
    setAllSessions((entries) =>
      entries.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    setPending(undefined);
    setInk([]);
  }

  async function finishStroke(events: RecordedEvent[], currentPlan: TrialPlan) {
    if (!session || !database) {
      return;
    }
    if (currentPlan.warmup) {
      await advance(session);
      return;
    }

    const isDiscarded = strokeLength(events) < 12;
    const trial: RecordedTrial = {
      id: currentPlan.id,
      sessionId: session.id,
      blockId: currentPlan.blockId,
      plan: currentPlan,
      events,
      overlay: isDiscarded ? [] : fitOverlay(events, currentPlan.targetAngles),
      discarded: isDiscarded,
      recordedAt: new Date().toISOString(),
    };
    await put(database, 'trials', trial);
    if (isDiscarded) {
      await advance(session, trial);
    } else {
      setPending(trial);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!plan || pending || !surface.current || event.pointerType !== 'touch') {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const first = record(
      event.nativeEvent,
      'pointerdown',
      event.currentTarget.getBoundingClientRect(),
    );
    drawing.current = { pointerId: event.pointerId, events: [first] };
    setInk([first]);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drawing.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    state.events.push(
      ...coalesced.map((item) => record(item, 'pointermove', bounds, true)),
    );
    state.events.push(record(event.nativeEvent, 'pointermove', bounds));
    setInk([...state.events]);
  }

  function onPointerEnd(
    event: React.PointerEvent<HTMLDivElement>,
    type: EventKind,
  ) {
    const state = drawing.current;
    if (!state || state.pointerId !== event.pointerId || !plan) {
      return;
    }
    state.events.push(
      record(
        event.nativeEvent,
        type,
        event.currentTarget.getBoundingClientRect(),
      ),
    );
    drawing.current = undefined;
    setInk([...state.events]);
    void finishStroke(state.events, plan).catch((error_: unknown) => {
      setError(String(error_));
    });
  }

  async function label(value: 'accept' | 'reject' | 'unsure') {
    if (!session || !pending) {
      return;
    }
    try {
      await advance(session, { ...pending, label: value });
    } catch (error_) {
      setError(String(error_));
    }
  }

  async function exportFiles(entry: Session) {
    if (!database) {
      return;
    }
    const saved = await trials(database, entry.id);
    for (const file of exportSession(entry, saved)) {
      download(`${entry.id}-${file.name}`, file.content);
    }
  }

  async function remove(entry: Session) {
    if (
      !database ||
      !globalThis.confirm(
        `Delete session ${entry.number} from this device? Download it first.`,
      )
    ) {
      return;
    }

    await clearSession(database, entry.id);
    setAllSessions((entries) => entries.filter((item) => item.id !== entry.id));
    if (session?.id !== entry.id) {
      return;
    }

    setSession(undefined);
    setPending(undefined);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-4 p-4 text-slate-900">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-sm font-semibold tracking-wider text-teal-700 uppercase">
            Touch corpus · v1
          </p>
          <h1 className="text-2xl font-bold">Stroke collector</h1>
        </div>
        <p className="text-sm text-slate-600">
          Tablet portrait · flat on table · dominant index finger
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded bg-red-100 p-3 text-red-900">
          {error}
        </p>
      )}
      {!session && (
        <section className="rounded-xl border p-4">
          <h2 className="font-semibold">Start a session</h2>
          <p className="mb-3 text-sm">
            Record on different days. Session 4 is held out. Download each
            session when it ends.
          </p>
          <label className="block text-sm">
            Device model{' '}
            <input
              className="ml-2 rounded border p-2"
              value={device}
              onChange={(event) => {
                setDevice(event.target.value);
              }}
              placeholder="Tablet model"
            />
          </label>
          <button
            className="mt-3 rounded bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={!database || !device.trim()}
            onClick={() => {
              void startSession();
            }}
          >
            Start session {allSessions.length + 1}
          </button>
        </section>
      )}
      {session && !session.completedAt && display && (
        <>
          <section
            className="rounded-xl border bg-teal-50 p-3"
            aria-label="Target mark"
          >
            <div className="flex items-center justify-between">
              <strong>Target mark</strong>
              <span className="text-sm">
                Session {session.number} · block{' '}
                {session.blocks.indexOf(block ?? session.blocks[0]!) + 1}/12 ·
                trial {session.nextIndex + 1}/{total}
              </span>
            </div>
            <svg
              className="mx-auto h-32 w-48 overflow-visible"
              viewBox="-30 -40 210 170"
              aria-label={`Directions ${display.targetAngles.join(', ')} degrees`}
            >
              <path
                d={trace(targetDiagram(display.targetAngles))}
                fill="none"
                stroke="#0f766e"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="68" cy="55" r="5" fill="#0f766e" />
            </svg>
            <p className="text-center text-sm">
              {display.breadth} items per level · depth {display.depth} ·{' '}
              {display.warmup
                ? 'Warmup (not saved)'
                : pending
                  ? 'Review this stroke'
                  : 'Draw one continuous stroke below'}
            </p>
          </section>
          <div
            ref={surface}
            className="relative min-h-[45vh] flex-1 overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-50"
            style={{ touchAction: 'none' }}
            aria-label="Drawing area"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => {
              onPointerEnd(event, 'pointerup');
            }}
            onPointerCancel={(event) => {
              onPointerEnd(event, 'pointercancel');
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <path
                d={trace(points)}
                fill="none"
                stroke="#1e293b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pending && (
                <path
                  d={trace(pending.overlay)}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="3"
                  strokeDasharray="8 5"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
          {pending && (
            <div
              className="flex justify-center gap-3"
              aria-label="Label stroke"
            >
              {(['accept', 'reject', 'unsure'] as const).map((value) => (
                <button
                  key={value}
                  className="rounded bg-teal-700 px-5 py-3 font-semibold text-white capitalize"
                  onClick={() => {
                    void label(value);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          <p className="text-center text-sm text-slate-600">
            {pending
              ? 'Dashed pink line: fitted target. Judge whether your stroke matches it.'
              : 'The target area does not record touches. Short accidental touches are logged and discarded.'}
          </p>
        </>
      )}
      {session?.completedAt && (
        <section className="rounded-xl border bg-teal-50 p-4">
          <h2 className="font-semibold">Session {session.number} complete</h2>
          <p>
            Download all three files now. Browser storage may be cleared after
            inactivity.
          </p>
          <button
            className="mt-3 rounded bg-teal-700 px-4 py-2 font-semibold text-white"
            onClick={() => {
              void exportFiles(session);
            }}
          >
            Download session files
          </button>
          <button
            className="ml-3 rounded border px-4 py-2"
            onClick={() => {
              setSession(undefined);
            }}
          >
            Back to sessions
          </button>
        </section>
      )}
      {allSessions.length > 0 && (
        <section className="border-t pt-3">
          <h2 className="font-semibold">Saved sessions</h2>
          <ul className="mt-2 space-y-2">
            {allSessions.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
              >
                <span>
                  Session {entry.number} · {entry.startedAt.slice(0, 10)} ·{' '}
                  {entry.completedAt ? 'complete' : 'in progress'}
                </span>
                <span className="flex gap-2">
                  <button
                    className="rounded border px-3 py-1"
                    onClick={() => {
                      void exportFiles(entry);
                    }}
                  >
                    Download
                  </button>
                  <button
                    className="rounded border px-3 py-1 text-red-700"
                    onClick={() => {
                      void remove(entry);
                    }}
                  >
                    Clear
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
