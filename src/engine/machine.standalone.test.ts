import { fakeTimers } from '../__fixtures__/timers.js';
import { createModel } from '../model.js';
import type { Point } from '../utils.js';
import {
  navigationMachine,
  type NavigationLayoutAnnouncement,
} from './machine.js';

// "right" is a submenu, then down, left, up: clockwise from the right.
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
  deadZoneRadius: 40,
  submenuOpeningDelay: 200,
};

type Host = ReturnType<typeof navigationMachine.start>;

/**
Dwell into novice mode at the origin, from a fresh host.
*/
const openNovice = (host: Host): void => {
  host.send('down', { position: [0, 0] });
  host.send('dwell');
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

describe('navigationMachine standalone phase', () => {
  // "right" is the submenu, then down, left, up: clockwise from the right.
  const standaloneModel = submenuModel;
  const [rightItem, downItem, leftItem, upItem] = standaloneModel.items;
  const [rightUpItem] = rightItem.items;

  const startStandalone = () =>
    navigationMachine.start({ model: standaloneModel, options });

  const openStandalone = (
    host: ReturnType<typeof startStandalone>,
    position: Point = [50, 60],
  ): void => {
    host.send('open', { position });
  };

  /**
   Every field a public output can carry, unknown when it is not a given
   output's own: the tests read the ones they care about.
   */
  type OutputData = {
    readonly mode: string;
    readonly position: unknown;
    readonly menu: unknown;
    readonly menuCenter: unknown;
    readonly active: unknown;
    readonly previousActive: unknown;
    readonly selection: unknown;
    readonly recognition: unknown;
  };

  /**
  Record every public output as `[name, data]`, in order.
  */
  const recordOutputs = (
    host: ReturnType<typeof startStandalone>,
  ): Array<[string, OutputData]> => {
    const outputs: Array<[string, OutputData]> = [];
    for (const output of [
      'start',
      'move',
      'open',
      'change',
      'select',
      'cancel',
      'feedback',
    ] as const) {
      host.on(output, ({ data }) => {
        outputs.push([output, data as unknown as OutputData]);
      });
    }

    return outputs;
  };

  const namesOf = (outputs: Array<[string, unknown]>): string[] =>
    outputs.map(([name]) => name);

  const dataAt = (
    outputs: Array<[string, OutputData]>,
    index: number,
  ): OutputData => {
    const output = outputs[index];
    if (output === undefined) {
      throw new Error(`No output at index ${index}.`);
    }

    return output[1];
  };

  const activeKeyOf = (host: ReturnType<typeof startStandalone>) =>
    host.current.name === 'standalone'
      ? host.current.data.active?.key
      : undefined;

  describe('opening', () => {
    it('opens the root at a fixed center, with nothing active and no pointer position', () => {
      const host = startStandalone();
      const outputs = recordOutputs(host);

      openStandalone(host, [50, 60]);

      expect(host.current.name).toBe('standalone');
      const event = dataAt(outputs, 0);
      expect(event.mode).toBe('standalone');
      expect(event.position).toBeUndefined();
      expect(event.menu).toBe(standaloneModel);
      expect(event.menuCenter).toEqual([50, 60]);
      expect(event.recognition).toBeUndefined();
      expect(namesOf(outputs)).toEqual(['open']);
    });

    it('lays out the root at the center, with no stroke, indicator or hidden cursor', () => {
      const host = startStandalone();
      const layouts = recordLayouts(host);

      openStandalone(host, [50, 60]);

      expect(layouts).toEqual([
        {
          cursor: 'default',
          menu: {
            model: standaloneModel,
            center: [50, 60],
            activeKey: undefined,
            tabStopKey: rightItem.key,
          },
          upperStroke: undefined,
          lowerStroke: undefined,
          indicator: undefined,
        },
      ]);
    });

    it('runs no timer', () => {
      using _timers = fakeTimers();
      const host = startStandalone();

      openStandalone(host);
      vi.advanceTimersByTime(60_000);

      expect(vi.getTimerCount()).toBe(0);
      expect(host.current.name).toBe('standalone');
    });

    it('declines an open from any state but idle', () => {
      const host = startStandalone();
      openStandalone(host);
      const opened = host.current;

      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(opened);

      host.send('close');
      host.send('down', { position: [0, 0] });
      const startup = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(startup);

      host.send('move', { position: [100, 0] });
      const expert = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(expert);

      host.send('cancel', { position: [100, 0] });
      openNovice(host);
      const novice = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(novice);
    });

    it('can open again once it was closed', () => {
      const host = startStandalone();

      openStandalone(host);
      host.send('close');
      openStandalone(host, [5, 5]);

      expect(host.current.name).toBe('standalone');
    });
  });

  describe('what standalone leaves alone', () => {
    it('ignores pointer and dwell input', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);
      const opened = host.current;

      host.send('down', { position: [0, 0] });
      host.send('move', { position: [100, 0] });
      host.send('up', { position: [100, 0] });
      host.send('cancel', { position: [100, 0] });
      host.send('dwell');

      expect(host.current).toEqual(opened);
      expect(outputs).toEqual([]);
      expect(layouts).toEqual([]);
    });

    it('declines keyboard, focus and close input while idle or in a gesture', () => {
      const host = startStandalone();
      const outputs = recordOutputs(host);
      const send = () => {
        for (const intent of [
          'next',
          'previous',
          'first',
          'last',
          'activate',
          'enter',
          'leave',
          'escape',
          'close',
        ] as const) {
          host.send(intent);
        }

        host.send('focus', { key: rightItem.key });
      };

      send();
      expect(host.current.name).toBe('idle');

      openNovice(host);
      outputs.length = 0;
      const novice = host.current;
      send();
      expect(host.current).toEqual(novice);
      expect(outputs).toEqual([]);
    });

    it('emits no feedback, whatever ends it', () => {
      const host = startStandalone();
      const outputs = recordOutputs(host);

      openStandalone(host);
      host.send('close');
      openStandalone(host);
      host.send('first');
      host.send('activate');

      expect(namesOf(outputs)).not.toContain('feedback');
    });
  });

  describe('moving the active item with the keyboard', () => {
    it('walks the items clockwise, wrapping around, on next', () => {
      const host = startStandalone();
      openStandalone(host);

      const visited: Array<string | undefined> = [];
      for (let i = 0; i < 5; i += 1) {
        host.send('next');
        visited.push(activeKeyOf(host));
      }

      expect(visited).toEqual([
        rightItem.key,
        downItem.key,
        leftItem.key,
        upItem.key,
        rightItem.key,
      ]);
    });

    it('walks the items counterclockwise, wrapping around, on previous', () => {
      const host = startStandalone();
      openStandalone(host);

      const visited: Array<string | undefined> = [];
      for (let i = 0; i < 3; i += 1) {
        host.send('previous');
        visited.push(activeKeyOf(host));
      }

      expect(visited).toEqual([upItem.key, leftItem.key, downItem.key]);
    });

    it('goes to the first and last item on first and last', () => {
      const host = startStandalone();
      openStandalone(host);

      host.send('last');
      expect(activeKeyOf(host)).toBe(upItem.key);
      host.send('first');
      expect(activeKeyOf(host)).toBe(rightItem.key);
    });

    it('walks the items in the order the menu lists them, which is clockwise from the first', () => {
      const startedAtBottom = createModel({
        items: [
          { id: 'bottom', label: 'Bottom', angle: 90 },
          { id: 'left', label: 'Left', angle: 180 },
          { id: 'right', label: 'Right', angle: 0 },
        ],
      });
      const host = navigationMachine.start({
        model: startedAtBottom,
        options,
      });
      host.send('open', { position: [0, 0] });

      const visited: Array<string | undefined> = [];
      for (let i = 0; i < 3; i += 1) {
        host.send('next');
        visited.push(
          host.current.name === 'standalone'
            ? host.current.data.active?.id
            : undefined,
        );
      }

      expect(visited).toEqual(['bottom', 'left', 'right']);
    });

    it('announces a change, with no pointer position, each time the active item moves', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('next');
      host.send('next');

      const changes = outputs.filter(([name]) => name === 'change');
      expect(changes).toHaveLength(2);
      const first = dataAt(changes, 0);
      expect(first.mode).toBe('standalone');
      expect(first.position).toBeUndefined();
      expect(first.active).toBe(rightItem);
      expect(first.previousActive).toBeUndefined();
      expect(first.menu).toBe(standaloneModel);
      const second = dataAt(changes, 1);
      expect(second.active).toBe(downItem);
      expect(second.previousActive).toBe(rightItem);
    });

    it('highlights the active item in the layout and makes it the tab stop', () => {
      const host = startStandalone();
      openStandalone(host);
      const layouts = recordLayouts(host);

      host.send('next');
      host.send('next');

      expect(layouts.map((layout) => layout.menu?.activeKey)).toEqual([
        rightItem.key,
        downItem.key,
      ]);
      expect(layouts.map((layout) => layout.menu?.tabStopKey)).toEqual([
        rightItem.key,
        downItem.key,
      ]);
    });

    it('keeps a single item active, announcing nothing when there is nothing to move to', () => {
      const single = createModel({ items: [{ id: 'only', label: 'Only' }] });
      const host = navigationMachine.start({ model: single, options });
      host.send('open', { position: [0, 0] });
      host.send('next');
      const outputs = recordOutputs(host);

      host.send('next');
      host.send('previous');
      host.send('first');
      host.send('last');

      expect(outputs).toEqual([]);
    });
  });

  describe('focus', () => {
    it('makes the focused item active', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('focus', { key: leftItem.key });

      expect(activeKeyOf(host)).toBe(leftItem.key);
      expect(namesOf(outputs)).toEqual(['change']);
      expect(outputs[0]?.[1].active).toBe(leftItem);
    });

    it('declines the focus of the item that is already active, so an echo changes nothing', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: leftItem.key });
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);

      host.send('focus', { key: leftItem.key });

      expect(outputs).toEqual([]);
      expect(layouts).toEqual([]);
    });

    it('declines the focus of an item that is not in the displayed level', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('focus', { key: rightUpItem.key });
      host.send('focus', { key: 'nope' });

      expect(activeKeyOf(host)).toBeUndefined();
      expect(outputs).toEqual([]);
    });
  });

  describe('going down and up the levels', () => {
    it('enters the active submenu at the same center, and activates its first item', () => {
      const host = startStandalone();
      openStandalone(host, [50, 60]);
      host.send('focus', { key: rightItem.key });
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);

      host.send('enter');

      expect(namesOf(outputs)).toEqual(['open', 'change']);
      const opened = dataAt(outputs, 0);
      expect(opened.mode).toBe('standalone');
      expect(opened.menu).toBe(rightItem);
      expect(opened.menuCenter).toEqual([50, 60]);
      const changed = dataAt(outputs, 1);
      expect(changed.active).toBe(rightUpItem);
      expect(changed.previousActive).toBeUndefined();
      expect(changed.menu).toBe(rightItem);
      expect(layouts).toHaveLength(1);
      expect(layouts[0]?.menu).toEqual({
        model: rightItem,
        center: [50, 60],
        activeKey: rightUpItem.key,
        tabStopKey: rightUpItem.key,
      });
    });

    it('treats activate on a submenu like enter', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });
      const outputs = recordOutputs(host);

      host.send('activate');

      expect(host.current.name).toBe('standalone');
      expect(namesOf(outputs)).toEqual(['open', 'change']);
    });

    it('declines enter when no item, or a leaf, is active', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('enter');
      host.send('focus', { key: downItem.key });
      outputs.length = 0;
      host.send('enter');

      expect(activeKeyOf(host)).toBe(downItem.key);
      expect(outputs).toEqual([]);
    });

    it('leaves back to the parent, with the submenu item active again', () => {
      const host = startStandalone();
      openStandalone(host, [50, 60]);
      host.send('focus', { key: rightItem.key });
      host.send('enter');
      host.send('next');
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);

      host.send('leave');

      expect(namesOf(outputs)).toEqual(['open', 'change']);
      const opened = dataAt(outputs, 0);
      expect(opened.menu).toBe(standaloneModel);
      expect(opened.menuCenter).toEqual([50, 60]);
      const changed = dataAt(outputs, 1);
      expect(changed.active).toBe(rightItem);
      expect(changed.previousActive).toBeUndefined();
      expect(layouts[0]?.menu?.model).toBe(standaloneModel);
      expect(layouts[0]?.menu?.activeKey).toBe(rightItem.key);
    });

    it('declines leave at the root', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('next');
      const outputs = recordOutputs(host);

      host.send('leave');

      expect(host.current.name).toBe('standalone');
      expect(outputs).toEqual([]);
    });

    it('goes down and up several levels, one at a time', () => {
      const deep = createModel({
        items: [
          {
            id: 'a',
            label: 'A',
            items: [{ id: 'b', label: 'B', items: [{ id: 'c', label: 'C' }] }],
          },
        ],
      });
      const host = navigationMachine.start({ model: deep, options });
      host.send('open', { position: [0, 0] });
      host.send('next');
      host.send('enter');
      host.send('enter');
      const menus: unknown[] = [];
      host.on('open', ({ data }) => {
        menus.push(data.menu);
      });

      host.send('leave');
      host.send('leave');

      expect(menus).toEqual([deep.items[0], deep]);
    });
  });

  describe('ending', () => {
    it('selects the active leaf on activate', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: downItem.key });
      const outputs = recordOutputs(host);

      host.send('activate');

      expect(host.current.name).toBe('idle');
      expect(namesOf(outputs)).toEqual(['select']);
      const event = dataAt(outputs, 0);
      expect(event.mode).toBe('standalone');
      expect(event.position).toBeUndefined();
      expect(event.selection).toBe(downItem);
      expect(event.menu).toBe(standaloneModel);
      expect(event.recognition).toBeUndefined();
    });

    it('selects a leaf of a submenu, reporting the submenu it was in', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });
      host.send('enter');
      const outputs = recordOutputs(host);

      host.send('activate');

      const event = dataAt(outputs, 0);
      expect(event.selection).toBe(rightUpItem);
      expect(event.menu).toBe(rightItem);
    });

    it('lays out idle once it ended', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: downItem.key });
      const layouts = recordLayouts(host);

      host.send('activate');

      expect(layouts).toHaveLength(1);
      expect(layouts[0]?.menu).toBeUndefined();
    });

    it('declines activate while nothing is active', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('activate');

      expect(host.current.name).toBe('standalone');
      expect(outputs).toEqual([]);
    });

    it('cancels on close, whatever level it is on, reporting the active item', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });
      host.send('enter');
      const outputs = recordOutputs(host);

      host.send('close');

      expect(host.current.name).toBe('idle');
      expect(namesOf(outputs)).toEqual(['cancel']);
      const event = dataAt(outputs, 0);
      expect(event.mode).toBe('standalone');
      expect(event.position).toBeUndefined();
      expect(event.active).toBe(rightUpItem);
      expect(event.menu).toBe(rightItem);
      expect(event.recognition).toBeUndefined();
    });

    it('cancels on escape at the root, with nothing active', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('escape');

      expect(host.current.name).toBe('idle');
      const event = dataAt(outputs, 0);
      expect(namesOf(outputs)).toEqual(['cancel']);
      expect(event.active).toBeUndefined();
      expect(event.menu).toBe(standaloneModel);
    });

    it('goes back up a level on escape below the root, instead of canceling', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });
      host.send('enter');
      const outputs = recordOutputs(host);

      host.send('escape');

      expect(host.current.name).toBe('standalone');
      expect(namesOf(outputs)).toEqual(['open', 'change']);
      expect(activeKeyOf(host)).toBe(rightItem.key);
    });
  });

  it('goes back to idle on dispose, from any level', () => {
    const host = startStandalone();
    openStandalone(host);
    host.send('focus', { key: rightItem.key });
    host.send('enter');

    host.send('dispose');

    expect(host.current.name).toBe('idle');
  });
});
