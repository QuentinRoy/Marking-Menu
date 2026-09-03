import { fakeTimers } from '../__fixtures__/canvas.js';
import { createModel } from '../model.js';
import { recognizeMarkingMenuStroke } from '../recognizer/recognize-mm-stroke.js';
import type * as RecognizeModule from '../recognizer/recognize-mm-stroke.js';
import { navigationMachine } from './machine.js';

// Wraps the real recognizer rather than replacing it: every existing test
// keeps exercising genuine recognition geometry, and only the tests that
// need a specific (or impossible-to-construct) outcome override it with
// `mockReturnValueOnce`/`mockImplementationOnce`.
vi.mock('../recognizer/recognize-mm-stroke.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RecognizeModule>();
  return {
    ...actual,
    recognizeMarkingMenuStroke: vi.fn(actual.recognizeMarkingMenuStroke),
  };
});

const mockRecognize = vi.mocked(recognizeMarkingMenuStroke);

afterEach(() => {
  mockRecognize.mockClear();
});

const model = createModel({
  items: [
    { id: 'right', label: 'Right' },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
    { id: 'up', label: 'Up' },
  ],
});

// A second fixture, with "right" as a submenu rather than a leaf, for the
// tests that need to end a gesture on a non-leaf active item.
const submenuModel = createModel({
  items: [
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
    { id: 'up', label: 'Up' },
  ],
});

const options = {
  movementsThreshold: 5,
  noviceDwellingTime: 300,
  minSelectionDist: 40,
  minMenuSelectionDist: 80,
  submenuOpeningDelay: 200,
};

/**
Start a fresh host with the shared fixture model and options.
*/
const startHost = () => navigationMachine.start({ model, options });

/**
Dwell into novice mode at the origin, from a fresh host.
*/
const openNovice = (host: ReturnType<typeof startHost>): void => {
  host.send('down', { position: [0, 0] });
  host.send('dwell');
};

/**
Record every public output a host emits, in order, by name.
*/
const recordEmitted = (host: ReturnType<typeof startHost>): string[] => {
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

describe('navigationMachine', () => {
  it('recognizes directly from startup on pointer up, without an intermediate move', () => {
    const host = startHost();
    const emitted = recordEmitted(host);

    host.send('down', { position: [0, 0] });
    host.send('up', { position: [100, 0] });

    expect(host.current.name).toBe('idle');
    expect(emitted).toEqual(['start', 'select']);
  });

  it('stays in startup for movement below the threshold', () => {
    const host = startHost();

    host.send('down', { position: [0, 0] });
    host.send('move', { position: [1, 0] });

    expect(host.current.name).toBe('startup');
  });

  it('ignores a second down while a gesture is already in progress, in both startup and expert (the pointer source is the primary guard; the machine covers it defensively too)', () => {
    const host = startHost();

    host.send('down', { position: [0, 0] });
    const afterFirstDown = host.current;
    host.send('down', { position: [5, 5] });
    expect(host.current).toEqual(afterFirstDown);

    host.send('move', { position: [100, 0] });
    const afterExpert = host.current;
    host.send('down', { position: [5, 5] });
    expect(host.current).toEqual(afterExpert);
  });

  it('ignores stray movement or release input while idle', () => {
    const host = startHost();
    const idle = host.current;

    host.send('move', { position: [1, 1] });
    expect(host.current).toEqual(idle);

    host.send('up', { position: [1, 1] });
    expect(host.current).toEqual(idle);

    host.send('cancel', { position: [1, 1] });
    expect(host.current).toEqual(idle);
  });

  it('dispatches cancel, without attempting recognition, for a gesture with no movement at all', () => {
    const host = startHost();
    let cancelActive: unknown;
    host.on('cancel', ({ data }) => {
      cancelActive = data.active;
    });
    const selected = vi.fn<() => void>();
    host.on('select', selected);

    host.send('down', { position: [0, 0] });
    host.send('up', { position: [0, 0] });

    expect(host.current.name).toBe('idle');
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    expect(cancelActive).toBeNull();
  });

  it('dispatches cancel for a completed gesture that recognition does not match', () => {
    mockRecognize.mockReturnValueOnce(null);
    const host = startHost();
    const canceled = vi.fn<() => void>();
    host.on('cancel', canceled);

    host.send('down', { position: [0, 0] });
    host.send('move', { position: [100, 0] });
    host.send('up', { position: [120, 0] });

    expect(host.current.name).toBe('idle');
    expect(mockRecognize).toHaveBeenCalledTimes(1);
    expect(canceled).toHaveBeenCalledTimes(1);
  });

  it('dispatches cancel, never select, when the pointer is cancelled mid-gesture, even though the stroke would otherwise have recognized', () => {
    const host = startHost();
    const selected = vi.fn<() => void>();
    host.on('select', selected);
    let cancelActive: unknown;
    host.on('cancel', ({ data }) => {
      cancelActive = data.active;
    });

    host.send('down', { position: [0, 0] });
    host.send('move', { position: [100, 0] });
    expect(host.current.name).toBe('expert');

    host.send('cancel', { position: [100, 0] });

    expect(host.current.name).toBe('idle');
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    expect(cancelActive).toBeNull();
  });

  it('dispatches cancel when the pointer is cancelled during startup, before any movement crossed the threshold', () => {
    const host = startHost();
    const canceled = vi.fn<() => void>();
    host.on('cancel', canceled);

    host.send('down', { position: [0, 0] });
    host.send('cancel', { position: [0, 0] });

    expect(host.current.name).toBe('idle');
    expect(mockRecognize).not.toHaveBeenCalled();
    expect(canceled).toHaveBeenCalledTimes(1);
  });

  it('dispatches start as the very first output a gesture ever produces', () => {
    const host = startHost();
    const emitted = recordEmitted(host);

    host.send('down', { position: [0, 0] });

    expect(emitted[0]).toBe('start');
  });

  describe('startup dwelling into novice mode', () => {
    it('arms exactly one timer on down, and does not restart it on a self-transition (objective 12)', () => {
      using _timers = fakeTimers();
      const host = startHost();

      host.send('down', { position: [0, 0] });
      expect(vi.getTimerCount()).toBe(1);

      host.send('move', { position: [1, 0] });
      expect(host.current.name).toBe('startup');
      expect(vi.getTimerCount()).toBe(1);
    });

    it('opens novice mode at the gesture origin when the dwell fires without significant movement', () => {
      const host = startHost();
      const opened = vi.fn<(event: { menu: unknown }) => void>();
      host.on('open', ({ data }) => {
        opened(data);
      });

      host.send('down', { position: [0, 0] });
      host.send('move', { position: [1, 0] });
      host.send('dwell');

      expect(host.current.name).toBe('novice');
      expect(host.current.name === 'novice' && host.current.data.menu).toBe(
        model,
      );
      expect(
        host.current.name === 'novice' && host.current.data.menuCenter,
      ).toEqual([0, 0]);
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

      host.send('down', { position: [0, 0] });
      expect(vi.getTimerCount()).toBe(1);

      host.send('move', { position: [100, 0] });
      expect(host.current.name).toBe('expert');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('declines a dwell that arrives after startup has been left, as a silent no-op', () => {
      const host = startHost();
      host.send('down', { position: [0, 0] });
      host.send('move', { position: [100, 0] });
      expect(host.current.name).toBe('expert');
      const afterExpert = host.current;

      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('dwell');

      expect(host.current).toEqual(afterExpert);
      expect(opened).not.toHaveBeenCalled();
    });
  });

  describe('novice phase: pointing at items', () => {
    it('stays inactive while the pointer is within minSelectionDist of the menu center (objective 5)', () => {
      const host = startHost();
      const moved = vi.fn<(event: { active: unknown }) => void>();
      host.on('move', ({ data }) => {
        moved(data);
      });
      const changed = vi.fn<() => void>();
      host.on('change', changed);

      openNovice(host);
      host.send('move', { position: [10, 0] });

      expect(host.current.name).toBe('novice');
      expect(
        host.current.name === 'novice' && host.current.data.active,
      ).toBeNull();
      expect(moved).toHaveBeenCalledTimes(1);
      expect(moved.mock.calls[0]?.[0].active).toBeNull();
      expect(changed).not.toHaveBeenCalled();
    });

    it('activates the nearest item by angle once beyond minSelectionDist, and distinguishes a changed nearest item from continued pointing at the same one (objective 6)', () => {
      const host = startHost();
      const moved: unknown[] = [];
      host.on('move', ({ data }) => {
        moved.push(data.active);
      });
      const changed =
        vi.fn<(event: { active: unknown; previousActive: unknown }) => void>();
      host.on('change', ({ data }) => {
        changed(data);
      });

      openNovice(host);
      host.send('move', { position: [100, 0] });

      expect(host.current.name).toBe('novice');
      const active =
        host.current.name === 'novice' ? host.current.data.active : null;
      expect(active).not.toBeNull();
      expect((active as unknown as { id: string }).id).toBe('right');
      expect(moved).toEqual([active]);
      expect(changed).toHaveBeenCalledTimes(1);
      const changeData = changed.mock.calls[0]?.[0] as {
        active: unknown;
        previousActive: unknown;
      };
      expect(changeData.active).toBe(active);
      expect(changeData.previousActive).toBeNull();

      // Continued pointing at the same item: another `move`, no further `change`.
      host.send('move', { position: [110, 0] });
      expect(moved).toEqual([active, active]);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('cancels on pointer up, carrying the currently open menu and no active item', () => {
      const host = startHost();
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData:
        { active: unknown; menu: unknown; mode: string } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('up', { position: [0, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect(cancelData?.active).toBeNull();
      expect(cancelData?.menu).toBe(model);
      expect(cancelData?.mode).toBe('novice');
      expect(mockRecognize).not.toHaveBeenCalled();
    });

    it('cancels on pointer cancel the same way as pointer up', () => {
      const host = startHost();
      const canceled = vi.fn<() => void>();
      host.on('cancel', canceled);

      openNovice(host);
      host.send('cancel', { position: [0, 0] });

      expect(canceled).toHaveBeenCalledTimes(1);
    });

    it('ignores down and a stray dwell', () => {
      const host = startHost();
      openNovice(host);
      const inNovice = host.current;

      host.send('down', { position: [1, 1] });
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
      host.send('move', { position: [100, 0] }); // Activates "right"
      host.send('up', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(canceled).not.toHaveBeenCalled();
      expect((selectData?.selection as { id: string }).id).toBe('right');
      expect(selectData?.menu).toBe(model);
    });

    it('dispatches cancel, never select, when releasing on a non-leaf active item, carrying that item as active', () => {
      const host = navigationMachine.start({ model: submenuModel, options });
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { active: unknown; menu: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('move', { position: [100, 0] }); // Activates "right", a submenu
      expect(
        host.current.name === 'novice' &&
          (host.current.data.active as { isLeaf: boolean } | null)?.isLeaf,
      ).toBe(false);

      host.send('up', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.active as { id: string } | null)?.id).toBe('right');
      expect(cancelData?.menu).toBe(submenuModel);
    });

    it('dispatches cancel regardless of the active item being a leaf when the pointer is cancelled at the terminal sample (objective 8)', () => {
      const host = startHost();
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { active: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('move', { position: [100, 0] }); // Activates "right", a leaf

      host.send('cancel', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.active as { id: string } | null)?.id).toBe('right');
    });

    it('dispatches cancel when the pointer is cancelled on a non-leaf active item too (objective 8)', () => {
      const host = navigationMachine.start({ model: submenuModel, options });
      const selected = vi.fn<() => void>();
      host.on('select', selected);
      let cancelData: { active: unknown } | undefined;
      host.on('cancel', ({ data }) => {
        cancelData = data;
      });

      openNovice(host);
      host.send('move', { position: [100, 0] }); // Activates "right", a submenu

      host.send('cancel', { position: [100, 0] });

      expect(host.current.name).toBe('idle');
      expect(selected).not.toHaveBeenCalled();
      expect((cancelData?.active as { id: string } | null)?.id).toBe('right');
    });
  });

  describe('novice phase: dwelling into a submenu (objectives 9, 11)', () => {
    it('opens the submenu when the dwell fires beyond minMenuSelectionDist on a non-leaf active item', () => {
      const host = navigationMachine.start({ model: submenuModel, options });
      const opened: unknown[] = [];
      host.on('open', ({ data }) => {
        opened.push(data);
      });

      openNovice(host);
      host.send('move', { position: [100, 0] }); // Beyond minMenuSelectionDist (80), activates "right"
      const submenu =
        host.current.name === 'novice' ? host.current.data.active : null;
      expect(submenu).not.toBeNull();

      opened.length = 0; // Discard the root menu's own `open`
      host.send('dwell');

      // A genuine phase change: novice re-enters novice, but at the submenu.
      expect(host.current.name).toBe('novice');
      const data = host.current.name === 'novice' ? host.current.data : null;
      expect(data?.menu).toBe(submenu);
      expect(data?.menuCenter).toEqual([100, 0]);
      expect(data?.active).toBeNull();

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

    it('accumulates the prior stroke into the lower stroke and restarts the upper stroke from the new centre', () => {
      const host = navigationMachine.start({ model: submenuModel, options });

      openNovice(host); // Novice at [0, 0]; lowerStroke [[0,0]], upperStroke [[0,0]]
      host.send('move', { position: [100, 0] }); // UpperStroke [[0,0],[100,0]]
      host.send('dwell'); // Opens the submenu at [100, 0]

      const data = host.current.name === 'novice' ? host.current.data : null;
      expect(data?.upperStroke).toEqual([[100, 0]]);
      expect(data?.lowerStroke).toEqual([
        [0, 0],
        [0, 0],
        [100, 0],
      ]);
    });

    it('does not open when dwelling within minMenuSelectionDist, even on a non-leaf active item', () => {
      const host = navigationMachine.start({ model: submenuModel, options });
      openNovice(host);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      // Beyond minSelectionDist (40) so "right" is active, but within
      // minMenuSelectionDist (80).
      host.send('move', { position: [50, 0] });
      const rootMenu =
        host.current.name === 'novice' ? host.current.data.menu : null;

      host.send('dwell');

      expect(opened).not.toHaveBeenCalled();
      expect(host.current.name === 'novice' && host.current.data.menu).toBe(
        rootMenu,
      );
    });

    it('does not open on a leaf active item, regardless of distance', () => {
      const host = startHost(); // The plain, leaf-only fixture model
      openNovice(host);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('move', { position: [200, 0] }); // Well beyond minMenuSelectionDist
      host.send('dwell');

      expect(opened).not.toHaveBeenCalled();
      expect(host.current.name).toBe('novice');
    });

    it('does not open when nothing is active', () => {
      const host = navigationMachine.start({ model: submenuModel, options });
      openNovice(host);
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('move', { position: [10, 0] }); // Within minSelectionDist: active stays null
      host.send('dwell');

      expect(opened).not.toHaveBeenCalled();
    });

    it('a small movement leaves the pending submenu dwell untouched', () => {
      using _timers = fakeTimers();
      const host = navigationMachine.start({ model: submenuModel, options });
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('down', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice
      opened.mockClear();

      host.send('move', { position: [100, 0] }); // Significant: activates "right", (re)starts the submenu dwell
      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      host.send('move', { position: [102, 0] }); // Insignificant (<5px): must not reset it
      vi.advanceTimersByTime(10);

      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('significant movement resets the submenu dwell rather than opening it (objective 9)', () => {
      using _timers = fakeTimers();
      const host = navigationMachine.start({ model: submenuModel, options });
      const opened = vi.fn<() => void>();
      host.on('open', opened);

      host.send('down', { position: [0, 0] });
      vi.advanceTimersByTime(options.noviceDwellingTime); // Startup dwell -> novice
      opened.mockClear();

      host.send('move', { position: [100, 0] }); // Starts the submenu dwell
      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      host.send('move', { position: [200, 0] }); // Significant: restarts it
      vi.advanceTimersByTime(10);

      // Would have fired here without the reset.
      expect(opened).not.toHaveBeenCalled();

      vi.advanceTimersByTime(options.submenuOpeningDelay - 10);
      // Fires `submenuOpeningDelay` after the *second* move instead.
      expect(opened).toHaveBeenCalledTimes(1);
    });
  });
});
