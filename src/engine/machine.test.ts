import { fakeTimers } from '../__fixtures__/timers.js';
import type { MarkingMenuChangeEvent } from '../events.js';
import { createModel } from '../model.js';
import type { Point } from '../utils.js';
import {
  navigationMachine,
  type NavigationFeedbackAnnouncement,
  type NavigationLayoutAnnouncement,
} from './machine.js';

// Listed starting from "up": default angles start at the top, so this order
// alone keeps a rightward move activating `right`.
const model = createModel({
  items: [
    { id: 'up', label: 'Up' },
    { id: 'right', label: 'Right' },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
  ],
});

// A second fixture, with "right" as a submenu rather than a leaf, for the
// tests that need to end a gesture on a non-leaf active item.
const submenuModel = createModel({
  items: [
    { id: 'up', label: 'Up' },
    {
      id: 'right',
      label: 'Right',
      items: [
        { id: 'rightUp', label: 'Right Up' },
        { id: 'rightDown', label: 'Right Down' },
      ],
    },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
  ],
});

const options = {
  movementsThreshold: 5,
  noviceDwellingTime: 300,
  deadZoneRadius: 40,
  submenuOpeningDelay: 200,
};

type Host = ReturnType<typeof navigationMachine.start>;

const activeItems = new WeakMap<Host, MarkingMenuChangeEvent['activeItem']>();

/**
Start a fresh host on `menuModel`, with the shared options, following the
active item through its `change` events.
*/
const startHost = (menuModel: typeof model | typeof submenuModel = model) => {
  const host = navigationMachine.start({ model: menuModel, options });
  host.on('change', ({ data }) => {
    activeItems.set(host, data.activeItem);
  });
  return host;
};

/**
The item the last `change` made active, if any.
*/
const activeItemOf = (host: Host) => activeItems.get(host);

/**
Dwell into novice mode at the origin, from a fresh host.
*/
const openNovice = (host: Host): void => {
  host.send('pointerDown', { position: [0, 0] });
  host.send('dwell');
};

/**
Record every public output a host emits, in order, by name.
*/
const recordEmitted = (host: Host): string[] => {
  const emitted: string[] = [];
  for (const output of [
    'start',
    'move',
    'open',
    'change',
    'select',
    'cancel',
  ] as const) {
    host.on(output, ({ output: name }) => {
      emitted.push(name);
    });
  }

  return emitted;
};

/**
Record every layout announcement a host makes, in order.
*/
const recordLayouts = (host: Host): NavigationLayoutAnnouncement[] => {
  const layouts: NavigationLayoutAnnouncement[] = [];
  host.on('layout', ({ data }) => {
    layouts.push(data);
  });
  return layouts;
};

/**
Record every feedback announcement a host makes, in order.
*/
const recordFeedback = (host: Host): NavigationFeedbackAnnouncement[] => {
  const feedback: NavigationFeedbackAnnouncement[] = [];
  host.on('feedback', ({ data }) => {
    feedback.push(data);
  });
  return feedback;
};

describe('navigationMachine', () => {
  it('recognizes directly from startup on pointer up, without an intermediate move', () => {
    const host = startHost();
    const emitted = recordEmitted(host);

    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerUp', { position: [100, 0] });

    expect(host.current.name).toBe('idle');
    expect(emitted).toEqual(['start', 'select']);
  });

  it('stays in startup for movement below the threshold', () => {
    const host = startHost();

    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerMove', { position: [1, 0] });

    expect(host.current.name).toBe('startup');
  });

  // The pointer source is the primary guard; the machine covers it defensively too.
  it('ignores a second down mid-gesture, in startup, expert, and novice alike', () => {
    const host = startHost();

    const emitted = recordEmitted(host);
    const layouts = recordLayouts(host);
    const expectSecondDownIgnored = (phase: string) => {
      emitted.length = 0;
      layouts.length = 0;
      host.send('pointerDown', { position: [5, 5] });
      expect(host.current.name).toBe(phase);
      expect(emitted).toEqual([]);
      expect(layouts).toEqual([]);
    };

    host.send('pointerDown', { position: [0, 0] });
    expectSecondDownIgnored('startup');

    host.send('pointerMove', { position: [100, 0] });
    expectSecondDownIgnored('expert');

    host.send('pointerUp', { position: [100, 0] });
    openNovice(host);
    expectSecondDownIgnored('novice');
  });

  it('ignores stray movement or release input while idle', () => {
    const host = startHost();
    const emitted = recordEmitted(host);
    const layouts = recordLayouts(host);

    host.send('pointerMove', { position: [1, 1] });
    host.send('pointerUp', { position: [1, 1] });
    host.send('pointerCancel', { position: [1, 1] });

    expect(host.current.name).toBe('idle');
    expect(emitted).toEqual([]);
    expect(layouts).toEqual([]);
  });

  it('dispatches cancel, without attempting recognition, for a gesture with no movement at all', () => {
    const host = startHost();
    let cancelActive: unknown;
    host.on('cancel', ({ data }) => {
      cancelActive = data.activeItem;
    });
    const selected = vi.fn<() => void>();
    host.on('select', selected);

    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerUp', { position: [0, 0] });

    expect(host.current.name).toBe('idle');
    expect(selected).not.toHaveBeenCalled();
    expect(cancelActive).toBeUndefined();
  });

  it('dispatches cancel for a completed gesture that recognition does not match', () => {
    const host = startHost();
    const canceled = vi.fn<() => void>();
    host.on('cancel', canceled);

    // A second segment leaves the leaf "right" with nowhere to go.
    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerMove', { position: [100, 0] });
    host.send('pointerMove', { position: [100, 100] });
    host.send('pointerUp', { position: [100, 100] });

    expect(host.current.name).toBe('idle');
    expect(canceled).toHaveBeenCalledTimes(1);
  });

  it('dispatches cancel, never select, when the pointer is cancelled mid-gesture, even though the stroke would otherwise have recognized', () => {
    const host = startHost();
    const selected = vi.fn<() => void>();
    host.on('select', selected);
    let cancelActive: unknown;
    host.on('cancel', ({ data }) => {
      cancelActive = data.activeItem;
    });

    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerMove', { position: [100, 0] });
    expect(host.current.name).toBe('expert');

    host.send('pointerCancel', { position: [100, 0] });

    expect(host.current.name).toBe('idle');
    expect(selected).not.toHaveBeenCalled();
    expect(cancelActive).toBeUndefined();
  });

  it('dispatches cancel when the pointer is cancelled during startup, before any movement crossed the threshold', () => {
    const host = startHost();
    const canceled = vi.fn<() => void>();
    host.on('cancel', canceled);

    host.send('pointerDown', { position: [0, 0] });
    host.send('pointerCancel', { position: [0, 0] });

    expect(host.current.name).toBe('idle');
    expect(canceled).toHaveBeenCalledTimes(1);
  });

  describe('cancel reason', () => {
    const recordReasons = (host: Host): unknown[] => {
      const reasons: unknown[] = [];
      host.on('cancel', ({ data }) => {
        reasons.push(data.reason);
      });
      return reasons;
    };

    it('is no-selection when a release finds nothing to select', () => {
      const host = startHost();
      const reasons = recordReasons(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerMove', { position: [100, 100] });
      host.send('pointerUp', { position: [100, 100] });

      expect(reasons).toEqual(['no-selection']);
    });

    it('is no-selection when an expert dwell finds nothing to open', () => {
      const host = startHost();
      const reasons = recordReasons(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell');

      expect(reasons).toEqual(['no-selection']);
    });

    it('is interrupted when the pointer is canceled', () => {
      const host = startHost();
      const reasons = recordReasons(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerCancel', { position: [100, 0] });

      expect(reasons).toEqual(['interrupted']);
    });
  });

  it('dispatches start as the very first output a gesture ever produces', () => {
    const host = startHost();
    const emitted = recordEmitted(host);

    host.send('pointerDown', { position: [0, 0] });

    expect(emitted[0]).toBe('start');
  });

  describe('startup dwelling into novice mode', () => {
    it('arms exactly one timer on down, and does not restart it on a self-transition (objective 12)', () => {
      using _timers = fakeTimers();
      const host = startHost();

      host.send('pointerDown', { position: [0, 0] });
      expect(vi.getTimerCount()).toBe(1);

      host.send('pointerMove', { position: [1, 0] });
      expect(host.current.name).toBe('startup');
      expect(vi.getTimerCount()).toBe(1);
    });

    it('opens novice mode at the gesture origin when the dwell fires without significant movement', () => {
      const host = startHost();
      const opened = vi.fn<(event: { menu: unknown }) => void>();
      host.on('open', ({ data }) => {
        opened(data);
      });

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [1, 0] });
      host.send('dwell');

      expect(host.current.name).toBe('novice');
      expect(opened).toHaveBeenCalledTimes(1);
      const event = opened.mock.calls[0]?.[0] as {
        mode: string;
        menu: unknown;
        menuCenter: number[];
        position: number[];
      };
      expect(event.mode).toBe('novice');
      expect(event.menu).toBe(model);
      expect(event.menuCenter).toEqual([0, 0]);
      // The position is the last committed one, despite `dwell` itself
      // carrying no position of its own.
      expect(event.position).toEqual([1, 0]);
    });

    it('crossing movementsThreshold clears the dwell timer and switches to expert instead, mutually exclusive with the dwell', () => {
      using _timers = fakeTimers();
      const host = startHost();

      host.send('pointerDown', { position: [0, 0] });
      expect(vi.getTimerCount()).toBe(1);

      host.send('pointerMove', { position: [100, 0] });
      expect(host.current.name).toBe('expert');
      // The startup dwell is gone, replaced by expert's own mid-gesture
      // dwell: still exactly one timer, never zero or two.
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('expert phase: dwelling into novice or canceling', () => {
    it('switches to novice rooted at the recognized menu', () => {
      const host = startHost(submenuModel);
      const opened: unknown[] = [];
      host.on('open', ({ data }) => {
        opened.push(data);
      });

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] }); // Crosses the threshold, onto "right"
      expect(host.current.name).toBe('expert');

      host.send('dwell');

      expect(host.current.name).toBe('novice');
      const rightMenu = submenuModel.items[1];
      expect(opened).toHaveLength(1);
      const event = opened[0] as {
        mode: string;
        menu: unknown;
        menuCenter: number[];
      };
      expect(event.mode).toBe('novice');
      expect(event.menu).toBe(rightMenu);
      expect(event.menuCenter).toEqual([100, 0]);
    });

    it('announces the expert stroke as the lower stroke when switching to novice', () => {
      const host = startHost(submenuModel);
      const layouts = recordLayouts(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell');

      expect(layouts.at(-1)?.lowerStroke).toEqual([
        [0, 0],
        [100, 0],
      ]);
    });

    it('cancels the expert attempt when the dwell recognizes only the root', () => {
      const host = startHost(); // The plain, leaf-only fixture model: every dwell recognizes the root.
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      const opened = vi.fn<() => void>();
      host.on('open', opened);
      let cancelData:
        { activeItem: unknown; menu: unknown; mode: string } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      expect(host.current.name).toBe('expert');

      host.send('dwell');

      expect(host.current.name).toBe('idle');
      expect(opened).not.toHaveBeenCalled();
      expect(selected).not.toHaveBeenCalled();
      expect(cancelData?.mode).toBe('expert');
      expect(cancelData?.activeItem).toBeUndefined();
      expect(cancelData?.menu).toBeUndefined();
    });

    it('restarts the mid-expert dwell on significant movement', () => {
      using _timers = fakeTimers();
      const host = startHost();

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] }); // Enters expert, arms the dwell
      expect(vi.getTimerCount()).toBe(1);

      vi.advanceTimersByTime(options.noviceDwellingTime - 10);
      host.send('pointerMove', { position: [200, 0] }); // Significant: restarts it
      vi.advanceTimersByTime(10);

      expect(host.current.name).toBe('expert'); // Would have fired here without the reset.

      vi.advanceTimersByTime(options.noviceDwellingTime - 10);
      expect(host.current.name).toBe('idle'); // Fires noviceDwellingTime after the second move instead.
    });

    it('leaves a pending mid-expert dwell untouched by insignificant movement', () => {
      using _timers = fakeTimers();
      const host = startHost();

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime - 10);
      host.send('pointerMove', { position: [102, 0] }); // Insignificant (<5px): must not reset it
      vi.advanceTimersByTime(10);

      expect(host.current.name).toBe('idle');
    });
  });

  describe('recognition records', () => {
    /**
    Collect the `recognition` of every event of `name`, in order.
    */
    const recordRecognitions = (
      host: Host,
      name: 'open' | 'select' | 'cancel',
    ): unknown[] => {
      const recognitions: unknown[] = [];
      host.on(name, ({ data }) => {
        recognitions.push(data.recognition);
      });
      return recognitions;
    };

    it('reports the stroke and its corners on the select a release found', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'select');

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerUp', { position: [200, 0] });

      expect(recognitions).toEqual([
        {
          stroke: [
            [0, 0],
            [100, 0],
            [200, 0],
          ],
          analysis: {
            articulationPoints: [
              [0, 0],
              [200, 0],
            ],
            segments: [
              {
                points: [
                  [0, 0],
                  [200, 0],
                ],
              },
            ],
          },
        },
      ]);
    });

    it('reports the failed attempt on the cancel a release produced', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'cancel');

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerMove', { position: [100, 100] });
      host.send('pointerUp', { position: [100, 100] });

      expect(recognitions).toEqual([
        {
          stroke: [
            [0, 0],
            [100, 0],
            [100, 100],
            [100, 100],
          ],
          analysis: {
            articulationPoints: [
              [0, 0],
              [100, 0],
              [100, 100],
            ],
            segments: [
              {
                points: [
                  [0, 0],
                  [100, 0],
                ],
              },
              {
                points: [
                  [100, 0],
                  [100, 100],
                ],
              },
            ],
          },
        },
      ]);
    });

    it('freezes the record so a listener cannot alter what the next one reads', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'select');

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerUp', { position: [200, 0] });

      const [recognition] = recognitions as [
        {
          stroke: unknown[];
          analysis: { articulationPoints: unknown[]; segments: unknown[] };
        },
      ];
      expect(Object.isFrozen(recognition)).toBe(true);
      expect(Object.isFrozen(recognition.stroke)).toBe(true);
      expect(Object.isFrozen(recognition.analysis)).toBe(true);
      expect(Object.isFrozen(recognition.analysis.articulationPoints)).toBe(
        true,
      );
      expect(Object.isFrozen(recognition.analysis.segments)).toBe(true);
    });

    it('copies every point, so a listener that alters one cannot reach the engine', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'select');
      const down: Point = [0, 0];
      const move: Point = [100, 0];
      const up: Point = [200, 0];

      host.send('pointerDown', { position: down });
      host.send('pointerMove', { position: move });
      host.send('pointerUp', { position: up });

      const [recognition] = recognitions as [
        {
          stroke: Point[];
          analysis: {
            articulationPoints: Point[];
            segments: Array<{ points: Point[] }>;
          };
        },
      ];
      const published = [
        ...recognition.stroke,
        ...recognition.analysis.articulationPoints,
        ...recognition.analysis.segments.flatMap((segment) => segment.points),
      ];
      expect(published.length).toBeGreaterThan(0);
      for (const point of published) {
        expect(Object.isFrozen(point)).toBe(true);
        expect([down, move, up]).not.toContain(point);
      }

      expect(Object.isFrozen(recognition.analysis.segments[0])).toBe(true);
      expect(Object.isFrozen(recognition.analysis.segments[0]?.points)).toBe(
        true,
      );
    });

    it('carries no recognition when nothing was recognized', () => {
      const host = startHost();
      const selects = recordRecognitions(host, 'select');
      const cancels = recordRecognitions(host, 'cancel');
      const opens = recordRecognitions(host, 'open');

      // A zero-length release, a pointer cancel, and a novice release
      // recognize nothing.
      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerUp', { position: [0, 0] });
      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerCancel', { position: [100, 0] });
      openNovice(host);
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerUp', { position: [100, 0] });

      expect(cancels).toEqual([undefined, undefined]);
      expect(selects).toEqual([undefined]);
      expect(opens).toEqual([undefined]);
    });

    it('reports the menu attempt on the open an expert dwell produced', () => {
      const host = startHost(submenuModel);
      const recognitions = recordRecognitions(host, 'open');

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell');

      expect(recognitions).toEqual([
        {
          stroke: [
            [0, 0],
            [100, 0],
          ],
          analysis: {
            articulationPoints: [
              [0, 0],
              [100, 0],
            ],
            segments: [
              {
                points: [
                  [0, 0],
                  [100, 0],
                ],
              },
            ],
          },
        },
      ]);
    });

    it('reports the menu attempt on the cancel an expert dwell produced', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'cancel');

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell');

      expect(recognitions).toHaveLength(1);
      expect(recognitions[0]).toMatchObject({
        stroke: [
          [0, 0],
          [100, 0],
        ],
      });
    });

    it('carries no recognition on the open a startup dwell produced', () => {
      const host = startHost();
      const recognitions = recordRecognitions(host, 'open');

      host.send('pointerDown', { position: [0, 0] });
      host.send('dwell');

      expect(recognitions).toEqual([undefined]);
    });

    it('announces the layout of an expert dwell once, without an in-between one', () => {
      const host = startHost(submenuModel);
      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      const layouts = recordLayouts(host);

      host.send('dwell');

      expect(layouts).toHaveLength(1);
      expect(layouts[0]?.menu?.center).toEqual([100, 0]);
    });
  });

  describe('novice phase: pointing at items', () => {
    it('stays inactive while the pointer is within the dead zone (objective 5)', () => {
      const host = startHost();
      const moved = vi.fn<(event: { activeItem: unknown }) => void>();
      host.on('move', ({ data }) => {
        moved(data);
      });
      const changed = vi.fn<() => void>();
      host.on('change', changed);

      openNovice(host);
      host.send('pointerMove', { position: [10, 0] });

      expect(host.current.name).toBe('novice');
      expect(moved).toHaveBeenCalledTimes(1);
      expect(moved.mock.calls[0]?.[0].activeItem).toBeUndefined();
      expect(changed).not.toHaveBeenCalled();
    });

    it('activates the nearest item by angle once past the dead zone, and distinguishes a changed nearest item from continued pointing at the same one (objective 6)', () => {
      const host = startHost();
      const moved: unknown[] = [];
      host.on('move', ({ data }) => {
        moved.push(data.activeItem);
      });
      const changed =
        vi.fn<
          (event: { activeItem: unknown; previousActiveItem: unknown }) => void
        >();
      host.on('change', ({ data }) => {
        changed(data);
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] });

      expect(host.current.name).toBe('novice');
      const active = activeItemOf(host);
      expect(active).not.toBeUndefined();
      expect(active?.id).toBe('right');
      expect(moved).toEqual([active]);
      expect(changed).toHaveBeenCalledTimes(1);
      const changeData = changed.mock.calls[0]?.[0] as {
        activeItem: unknown;
        previousActiveItem: unknown;
      };
      expect(changeData.activeItem).toBe(active);
      expect(changeData.previousActiveItem).toBeUndefined();

      // Continued pointing at the same item: another `move`, no further `change`.
      host.send('pointerMove', { position: [110, 0] });
      expect(moved).toEqual([active, active]);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('cancels on pointer up, carrying the currently open menu and no active item', () => {
      const host = startHost();
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData:
        { activeItem: unknown; menu: unknown; mode: string } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('pointerUp', { position: [0, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect(cancelData?.activeItem).toBeUndefined();
      expect(cancelData?.menu).toBe(model);
      expect(cancelData?.mode).toBe('novice');
    });

    it('cancels on pointer cancel the same way as pointer up', () => {
      const host = startHost();
      const canceled = vi.fn<() => void>();
      host.on('cancel', canceled);

      openNovice(host);
      host.send('pointerCancel', { position: [0, 0] });

      expect(canceled).toHaveBeenCalledTimes(1);
    });

    it('ignores down and a stray dwell', () => {
      using _timers = fakeTimers();
      const host = startHost();
      openNovice(host);
      const inNovice = host.current;

      host.send('pointerDown', { position: [1, 1] });
      expect(host.current).toEqual(inNovice);

      host.send('dwell');
      expect(host.current).toEqual(inNovice);
    });
  });

  describe('novice phase: committing or abandoning the gesture (objectives 7, 8)', () => {
    it('dispatches select carrying the leaf and the open menu when releasing on a leaf', () => {
      const host = startHost();
      const canceled = vi.fn<() => void>();
      host.on('cancel', canceled);
      let selectData: { selection: unknown; menu: unknown } | undefined;
      host.on('select', ({ data }) => {
        selectData = data;
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates "right"
      host.send('pointerUp', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(canceled).not.toHaveBeenCalled();
      expect((selectData?.selection as { id: string }).id).toBe('right');
      expect(selectData?.menu).toBe(model);
    });

    it('dispatches cancel, never select, when releasing on a non-leaf active item, carrying that item as active', () => {
      const host = startHost(submenuModel);
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { activeItem: unknown; menu: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates "right", a submenu
      expect(activeItemOf(host)?.isLeaf).toBe(false);

      host.send('pointerUp', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.activeItem as { id: string } | undefined)?.id).toBe(
        'right',
      );
      expect(cancelData?.menu).toBe(submenuModel);
    });

    it('dispatches cancel regardless of the active item being a leaf when the pointer is cancelled at the terminal sample (objective 8)', () => {
      const host = startHost();
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { activeItem: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates "right", a leaf

      host.send('pointerCancel', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.activeItem as { id: string } | undefined)?.id).toBe(
        'right',
      );
    });

    it('dispatches cancel when the pointer is cancelled on a non-leaf active item too (objective 8)', () => {
      const host = startHost(submenuModel);
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { activeItem: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates "right", a submenu

      host.send('pointerCancel', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.activeItem as { id: string } | undefined)?.id).toBe(
        'right',
      );
    });
  });

  describe('novice phase: dwelling into a submenu (objectives 9, 11)', () => {
    it('opens the submenu when the dwell fires on a non-leaf active item', () => {
      const host = startHost(submenuModel);
      const opened: unknown[] = [];
      host.on('open', ({ data }) => {
        opened.push(data);
      });

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Past the dead zone, activates "right"
      const submenu = activeItemOf(host);
      expect(submenu).not.toBeUndefined();

      opened.length = 0; // Discard the root menu's own `open`
      host.send('dwell');

      // A genuine phase change: novice re-enters novice, but at the submenu.
      expect(host.current.name).toBe('novice');
      expect(opened).toHaveLength(1);
      const event = opened[0] as {
        mode: string;
        menu: unknown;
        menuCenter: number[];
        position: number[];
      };
      expect(event.mode).toBe('novice');
      expect(event.menu).toBe(submenu);
      expect(event.menuCenter).toEqual([100, 0]);
      expect(event.position).toEqual([100, 0]);
    });

    it('opens the submenu just past the dead zone', () => {
      const host = startHost(submenuModel);
      openNovice(host);
      const opened = vi.fn<(event: { menu: unknown }) => void>();
      host.on('open', ({ data }) => {
        opened(data);
      });

      // Just past the dead zone (40): activation and dwelling share it.
      host.send('pointerMove', { position: [41, 0] });
      const submenu = activeItemOf(host);

      host.send('dwell');

      expect(opened).toHaveBeenCalledTimes(1);
      expect(opened.mock.calls[0]?.[0].menu).toBe(submenu);
    });

    it('does not open on a leaf active item, regardless of distance', () => {
      const host = startHost(); // The plain, leaf-only fixture model
      openNovice(host);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('pointerMove', { position: [200, 0] });
      host.send('dwell');

      expect(opened).not.toHaveBeenCalled();
      expect(host.current.name).toBe('novice');
    });

    it('does not open when nothing is active', () => {
      const host = startHost(submenuModel);
      openNovice(host);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('pointerMove', { position: [10, 0] }); // Within the dead zone: active stays undefined
      host.send('dwell');

      expect(opened).not.toHaveBeenCalled();
    });

    it('a small movement leaves the pending submenu dwell untouched', () => {
      using _timers = fakeTimers();
      const host = startHost(submenuModel);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('pointerDown', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice
      opened.mockClear();

      host.send('pointerMove', { position: [100, 0] }); // Significant: activates "right", (re)starts the submenu dwell
      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      host.send('pointerMove', { position: [102, 0] }); // Insignificant (<5px): must not reset it
      vi.advanceTimersByTime(10);

      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('significant movement resets the submenu dwell rather than opening it (objective 9)', () => {
      using _timers = fakeTimers();
      const host = startHost(submenuModel);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('pointerDown', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice
      opened.mockClear();

      host.send('pointerMove', { position: [100, 0] }); // Starts the submenu dwell
      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      host.send('pointerMove', { position: [200, 0] }); // Significant: restarts it
      vi.advanceTimersByTime(10);

      // Would have fired here without the reset.
      expect(opened).not.toHaveBeenCalled();

      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      // Fires `submenuOpeningDelay` after the *second* move instead.
      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('keeps a submenu-dwell timer armed for the freshly opened submenu, even with no wobble between the move that activated it and the dwell that opened it', () => {
      using _timers = fakeTimers();
      const host = startHost(submenuModel);
      const layouts = recordLayouts(host);

      host.send('pointerDown', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice at [0, 0]
      expect(vi.getTimerCount()).toBe(1); // The root menu's own submenu-dwell timer

      host.send('pointerMove', { position: [100, 0] }); // One significant move, straight onto "right"
      expect(vi.getTimerCount()).toBe(1); // Restarted, not doubled or dropped

      vi.advanceTimersByTime(options.submenuOpeningDelay);
      expect(host.current.name).toBe('novice');
      expect(layouts.at(-1)?.menu?.center).toEqual([100, 0]);
      // The residency must rearm on entering the submenu too, not stay
      // dropped because this particular transition's `dwellAnchor` happens
      // to be the very same reference the residency's `restart` predicate
      // compares against.
      expect(vi.getTimerCount()).toBe(1);
    });

    it('opens a submenu reached by an insignificant move away from a leaf whose own dwell just fired', () => {
      using _timers = fakeTimers();
      const host = startHost(submenuModel);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('pointerDown', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice
      opened.mockClear();

      // Just past the boundary between "down" (a leaf) and "right" (a
      // submenu): activates "down".
      host.send('pointerMove', { position: [69.47, 71.93] });
      expect(activeItemOf(host)?.id).toBe('down');

      // The dwell fires on the leaf: nothing opens, but the timer must not
      // be left dead for the rest of the gesture.
      vi.advanceTimersByTime(options.submenuOpeningDelay);
      expect(opened).not.toHaveBeenCalled();

      // Less than `movementsThreshold` away, crossing the boundary onto
      // "right".
      host.send('pointerMove', { position: [71.93, 69.47] });
      expect(activeItemOf(host)?.id).toBe('right');

      vi.advanceTimersByTime(options.submenuOpeningDelay);
      expect(opened).toHaveBeenCalledTimes(1);
    });
  });

  describe('the strokes it announces to the layout', () => {
    it('reduces the novice upper stroke to the menu center and the last position, whatever path the pointer took between them', () => {
      const host = startHost();
      const layouts = recordLayouts(host);

      openNovice(host);
      host.send('pointerMove', { position: [30, 20] });
      host.send('pointerMove', { position: [100, 0] });

      expect(layouts.at(-1)?.upperStroke).toEqual([
        [0, 0],
        [100, 0],
      ]);
    });

    it('keeps accumulating the startup and expert stroke point by point', () => {
      const host = startHost();
      const layouts = recordLayouts(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [1, 0] }); // Below the threshold: still startup.
      host.send('pointerMove', { position: [100, 0] }); // Crosses it: expert.
      host.send('pointerMove', { position: [100, 40] });

      expect(layouts.at(-1)?.upperStroke).toEqual([
        [0, 0],
        [1, 0],
        [100, 0],
        [100, 40],
      ]);
    });

    it("folds the parent menu's straight segment, not the pointer's path, into the lower stroke when a submenu opens", () => {
      const host = startHost(submenuModel);
      const layouts = recordLayouts(host);

      openNovice(host);
      host.send('pointerMove', { position: [30, 20] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell');

      expect(layouts.at(-1)?.lowerStroke).toEqual([
        [0, 0],
        [0, 0],
        [100, 0],
      ]);
      // The fresh submenu has had no move yet, so its segment is still a
      // single point drawn twice.
      expect(layouts.at(-1)?.upperStroke).toEqual([
        [100, 0],
        [100, 0],
      ]);
    });

    it('announces a completed novice gesture as one straight segment per menu level', () => {
      const host = startHost(submenuModel);
      const feedback = recordFeedback(host);

      openNovice(host);
      host.send('pointerMove', { position: [30, 20] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('dwell'); // Opens the "right" submenu, centered on [100, 0].
      host.send('pointerMove', { position: [70, -60] });
      host.send('pointerMove', { position: [100, -100] });
      host.send('pointerUp', { position: [100, -100] });

      // Each menu center repeats where one level's segment ends and the
      // next begins, and the release position repeats the last move.
      expect(feedback.at(-1)?.stroke).toEqual([
        [0, 0],
        [0, 0],
        [100, 0],
        [100, 0],
        [100, -100],
        [100, -100],
      ]);
    });
  });

  describe('the indicator it announces to the layout', () => {
    it('shows the indicator started at the current time while dwelling in startup', () => {
      const host = startHost();
      const layouts = recordLayouts(host);

      host.send('pointerDown', { position: [0, 0] });

      const indicator = layouts.at(-1)?.indicator;
      expect(typeof indicator?.startedAt).toBe('number');
      expect(indicator?.position).toEqual([0, 0]);
      expect(indicator?.delayMs).toBe(options.noviceDwellingTime);
    });

    it('shows the indicator at the dwell position while dwelling in expert mode', () => {
      const host = startHost();
      const layouts = recordLayouts(host);

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] }); // Crosses the threshold: expert.

      const indicator = layouts.at(-1)?.indicator;
      expect(typeof indicator?.startedAt).toBe('number');
      expect(indicator?.position).toEqual([100, 0]);
      expect(indicator?.delayMs).toBe(options.noviceDwellingTime);
    });

    it('shows no indicator in novice mode while the pointer is within the dead zone', () => {
      const host = startHost();
      const layouts = recordLayouts(host);

      openNovice(host);

      expect(layouts.at(-1)?.indicator).toBeUndefined();
    });

    it('shows no indicator in novice mode while the active item is a leaf', () => {
      const host = startHost(); // The plain, leaf-only fixture model.
      const layouts = recordLayouts(host);

      openNovice(host);
      host.send('pointerMove', { position: [200, 0] }); // Activates the leaf "right".

      expect(layouts.at(-1)?.indicator).toBeUndefined();
    });

    it('shows the indicator at the dwell position while the active item is a submenu', () => {
      const host = startHost(submenuModel);
      const layouts = recordLayouts(host);

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates the submenu "right".

      const indicator = layouts.at(-1)?.indicator;
      expect(typeof indicator?.startedAt).toBe('number');
      expect(indicator?.position).toEqual([100, 0]);
      expect(indicator?.delayMs).toBe(options.submenuOpeningDelay);
    });

    it("keeps drawing at the pointer's current position, but does not restart the dwell clock, when a small movement leaves the restart anchor untouched", () => {
      using _timers = fakeTimers();
      const host = startHost(submenuModel);
      const layouts = recordLayouts(host);

      openNovice(host);
      host.send('pointerMove', { position: [100, 0] }); // Activates the submenu "right".
      const firstStartedAt = layouts.at(-1)?.indicator?.startedAt;

      vi.advanceTimersByTime(10);
      host.send('pointerMove', { position: [102, 0] }); // Insignificant (<5px).

      expect(layouts.at(-1)?.indicator?.startedAt).toBe(firstStartedAt);
      expect(layouts.at(-1)?.indicator?.position).toEqual([102, 0]);
    });
  });
});
