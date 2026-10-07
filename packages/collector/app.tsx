import {
  TimelinePlayer,
  useConfirmBeforeUnload,
  useLogger,
  useTask,
} from '@lightmill/react-experiment';
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createClient,
  findResumableSessions,
  resumeSession,
  startSession,
  type Logger,
  type ResumableSession,
} from './lightmill.js';
import {
  makeTimeline,
  type CollectorLog,
  type EventKind,
  type Label,
  type Point,
  type RecordedEvent,
  type TrialTask,
} from './model.js';
import { fitOverlay, strokeLength } from './overlay.js';

declare module '@lightmill/react-experiment' {
  // Declaration merging, which registers these types, needs an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface RegisterExperiment {
    task: TrialTask;
    log: CollectorLog;
  }
}

const minimumStrokeLength = 12;

function trace(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
}

function targetDiagram(angles: number[]): Point[] {
  const start = { x: 68, y: 55 };
  const points = [start];
  let last = start;
  for (const angle of angles) {
    last = {
      x: last.x + Math.cos((angle * Math.PI) / 180) * 33,
      y: last.y + Math.sin((angle * Math.PI) / 180) * 33,
    };
    points.push(last);
  }

  return points;
}

function record(
  event: PointerEvent,
  type: EventKind,
  bounds: DOMRect,
  isCoalesced = false,
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
    coalesced: isCoalesced,
  };
}

type Stroke = { events: RecordedEvent[]; overlay: Point[] };

function Trial({ task, onDone }: { task: TrialTask; onDone: () => void }) {
  const log = useLogger();
  const [ink, setInk] = useState<RecordedEvent[]>([]);
  const [review, setReview] = useState<Stroke>();
  const drawing = useRef<
    { pointerId: number; events: RecordedEvent[] } | undefined
  >(undefined);

  const points = (review?.events ?? ink)
    .filter((event) => !event.coalesced)
    .map(({ x, y }) => ({ x, y }));

  function logTrial(stroke: Stroke, isDiscarded: boolean, label?: Label) {
    log({
      type: 'trial',
      taskNumber: task.taskNumber,
      trialId: task.trialId,
      blockId: task.blockId,
      breadth: task.breadth,
      depth: task.depth,
      targetIndices: task.targetIndices,
      targetAngles: task.targetAngles,
      events: stroke.events,
      overlay: stroke.overlay,
      discarded: isDiscarded,
      label,
    });
    onDone();
  }

  function finishStroke(events: RecordedEvent[]) {
    if (task.warmup) {
      log({
        type: 'warmup',
        taskNumber: task.taskNumber,
        trialId: task.trialId,
      });
      onDone();
    } else if (strokeLength(events) < minimumStrokeLength) {
      logTrial({ events, overlay: [] }, true);
    } else {
      setReview({ events, overlay: fitOverlay(events, task.targetAngles) });
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (
      review !== undefined ||
      drawing.current !== undefined ||
      event.pointerType !== 'touch'
    ) {
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
    if (state?.pointerId !== event.pointerId) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
    state.events.push(
      ...coalesced.map((item) => record(item, 'pointermove', bounds, true)),
      record(event.nativeEvent, 'pointermove', bounds),
    );
    setInk([...state.events]);
  }

  function onPointerEnd(
    event: React.PointerEvent<HTMLDivElement>,
    type: EventKind,
  ) {
    const state = drawing.current;
    if (state?.pointerId !== event.pointerId) {
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
    finishStroke(state.events);
  }

  return (
    <>
      <section
        className="rounded-xl border bg-teal-50 p-3"
        aria-label="Target mark"
      >
        <div className="flex items-center justify-between">
          <strong>Target mark</strong>
          <span className="text-sm">
            Block {task.blockNumber}/{task.blockCount} · task {task.taskNumber}
          </span>
        </div>
        <svg
          className="mx-auto h-32 w-48 overflow-visible"
          viewBox="-30 -40 210 170"
          aria-label={`Directions ${task.targetAngles.join(', ')} degrees`}
        >
          <path
            d={trace(targetDiagram(task.targetAngles))}
            fill="none"
            stroke="#0f766e"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="68" cy="55" r="5" fill="#0f766e" />
        </svg>
        <p className="text-center text-sm">
          {task.breadth} items per level · depth {task.depth} ·{' '}
          {task.warmup
            ? 'Warm-up (not recorded)'
            : review
              ? 'Review this stroke'
              : 'Draw one continuous stroke below'}
        </p>
      </section>
      <div
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
          {review && (
            <path
              d={trace(review.overlay)}
              fill="none"
              stroke="#e11d48"
              strokeWidth="3"
              strokeDasharray="8 5"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      {review && (
        <div className="flex justify-center gap-3" aria-label="Label stroke">
          {(['accept', 'reject', 'unsure'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="rounded bg-teal-700 px-5 py-3 font-semibold text-white capitalize"
              onClick={() => {
                logTrial(review, false, value);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-sm text-slate-600">
        {review
          ? 'Dashed pink line: fitted target. Judge whether your stroke matches it.'
          : 'The target area does not record touches. Short accidental touches are logged and discarded.'}
      </p>
    </>
  );
}

function CurrentTrial() {
  const { task, onTaskCompleted } = useTask('trial');
  return <Trial task={task} onDone={onTaskCompleted} />;
}

class RunErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override state: { error: unknown } = { error: undefined };

  override render(): React.ReactNode {
    if (this.state.error === undefined) {
      return this.props.children;
    }

    return (
      <p role="alert" className="rounded bg-red-100 p-3 text-red-900">
        {this.state.error instanceof Error
          ? this.state.error.message
          : 'The run stopped'}
        . Check the laptop server, then reload to resume after the last saved
        trial.
      </p>
    );
  }
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'choose'; resumable: ResumableSession[] }
  | {
      kind: 'running';
      logger: Logger;
      sessionNumber: number;
      completedTasks: number;
    }
  | { kind: 'completed'; sessionNumber: number };

function Session({
  logger,
  sessionNumber,
  completedTasks,
  onSaved,
}: {
  logger: Logger;
  sessionNumber: number;
  completedTasks: number;
  onSaved: () => void;
}) {
  const timeline = useMemo(() => makeTimeline(sessionNumber), [sessionNumber]);
  const state = useSyncExternalStore(logger.subscribe, () => logger.state);
  const [finished, setFinished] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saving = useRef(false);
  useConfirmBeforeUnload(state.status !== 'completed');

  function downloadUnsavedLogs() {
    const file = new Blob([JSON.stringify(logger.inFlightLogs, undefined, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-${sessionNumber}-unsaved-logs.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  useEffect(() => {
    if (!finished || state.status === 'paused' || saving.current) {
      return;
    }

    saving.current = true;
    void logger
      .completeRun()
      .then(onSaved)
      .catch((error: unknown) => {
        saving.current = false;
        if (logger.state.status !== 'paused') {
          setSaveError(String(error));
        }
      });
  }, [finished, logger, onSaved, saveAttempt, state.status]);

  return (
    <>
      {saveError !== '' && (
        <div role="alert" className="rounded bg-red-100 p-3 text-red-900">
          <p>{saveError}</p>
          {finished && (
            <button
              type="button"
              onClick={() => {
                setSaveError('');
                setSaveAttempt((attempt) => attempt + 1);
              }}
            >
              Try finishing the session again
            </button>
          )}
        </div>
      )}
      <TimelinePlayer
        timeline={timeline}
        onLog={async (log) => {
          try {
            await logger.addLog(log);
          } catch (error) {
            if (logger.state.status !== 'paused') {
              throw error;
            }
          }
        }}
        paused={state.status === 'paused'}
        {...(completedTasks > 0 && {
          resumeAfterTask: (task: TrialTask) =>
            task.taskNumber === completedTasks,
        })}
        onCompleted={() => {
          setFinished(true);
        }}
        elements={{
          tasks: { trial: <CurrentTrial /> },
          loading: <p>Loading…</p>,
          completed: <p>Saving the session…</p>,
          paused: (
            <section role="alert" className="rounded bg-amber-50 p-4">
              <p>Logs have not reached the laptop. Check the connection.</p>
              <button
                type="button"
                className="mt-2 rounded bg-teal-700 px-4 py-2 text-white"
                onClick={() => {
                  void logger.retry().catch((error: unknown) => {
                    setSaveError(String(error));
                  });
                }}
              >
                Try saving again
              </button>
              <button
                type="button"
                className="ml-2 rounded border px-4 py-2"
                onClick={downloadUnsavedLogs}
              >
                Download unsaved logs
              </button>
            </section>
          ),
        }}
      />
    </>
  );
}

export function App() {
  const client = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [sessionNumber, setSessionNumber] = useState('');
  const [device, setDevice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    findResumableSessions(client)
      .then((resumable) => {
        if (isActive) {
          setPhase({ kind: 'choose', resumable });
        }
      })
      .catch((error_: unknown) => {
        setError(String(error_));
      });
    return () => {
      isActive = false;
    };
  }, [client]);

  async function start() {
    const number = Number(sessionNumber);
    try {
      const logger = await startSession(client, number, device.trim());
      setPhase({
        kind: 'running',
        logger,
        sessionNumber: number,
        completedTasks: 0,
      });
    } catch (error_) {
      setError(String(error_));
    }
  }

  async function resume(session: ResumableSession) {
    try {
      const logger = await resumeSession(client, session);
      setPhase({
        kind: 'running',
        logger,
        sessionNumber: session.sessionNumber,
        completedTasks: session.completedTasks,
      });
    } catch (error_) {
      setError(String(error_));
    }
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
      {error !== '' && (
        <p role="alert" className="rounded bg-red-100 p-3 text-red-900">
          {error}
        </p>
      )}
      {phase.kind === 'loading' && error === '' && (
        <p>Connecting to the laptop…</p>
      )}
      {phase.kind === 'choose' && (
        <>
          {phase.resumable.map((session) => (
            <section
              key={session.sessionNumber}
              className="rounded-xl border p-4"
            >
              <h2 className="font-semibold">
                Session {session.sessionNumber} is unfinished
              </h2>
              <p className="mb-3 text-sm">
                {session.completedTasks} tasks saved.
              </p>
              <button
                type="button"
                className="rounded bg-teal-700 px-4 py-2 font-semibold text-white"
                onClick={() => {
                  void resume(session);
                }}
              >
                Resume session {session.sessionNumber}
              </button>
            </section>
          ))}
          {phase.resumable.length === 0 && (
            <section className="rounded-xl border p-4">
              <h2 className="font-semibold">Start a session</h2>
              <p className="mb-3 text-sm">
                Record sessions on different days. Back up the laptop database
                after each one.
              </p>
              <label className="block text-sm">
                Session number{' '}
                <input
                  className="ml-2 w-20 rounded border p-2"
                  inputMode="numeric"
                  value={sessionNumber}
                  onChange={(event) => {
                    setSessionNumber(event.target.value);
                  }}
                />
              </label>
              <label className="mt-2 block text-sm">
                Device model{' '}
                <input
                  className="ml-2 rounded border p-2"
                  value={device}
                  placeholder="Tablet model"
                  onChange={(event) => {
                    setDevice(event.target.value);
                  }}
                />
              </label>
              <button
                type="button"
                className="mt-3 rounded bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                disabled={
                  !/^[1-9]\d*$/v.test(sessionNumber) || device.trim() === ''
                }
                onClick={() => {
                  void start();
                }}
              >
                Start session {sessionNumber}
              </button>
            </section>
          )}
        </>
      )}
      {phase.kind === 'running' && (
        <RunErrorBoundary>
          <Session
            logger={phase.logger}
            sessionNumber={phase.sessionNumber}
            completedTasks={phase.completedTasks}
            onSaved={() => {
              setPhase({
                kind: 'completed',
                sessionNumber: phase.sessionNumber,
              });
            }}
          />
        </RunErrorBoundary>
      )}
      {phase.kind === 'completed' && (
        <section className="rounded-xl border bg-teal-50 p-4">
          <h2 className="font-semibold">
            Session {phase.sessionNumber} complete
          </h2>
          <p>Every trial is saved on the laptop. Back up its database now.</p>
        </section>
      )}
    </main>
  );
}
