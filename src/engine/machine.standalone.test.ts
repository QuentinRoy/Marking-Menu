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
  host.send('pointerDown', { position: [0, 0] });
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
    readonly reason: unknown;
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

  const keyOf = (id: 'right' | 'down' | 'left' | 'up') => {
    const item = standaloneModel.items.find((candidate) => candidate.id === id);
    if (item === undefined) {
      throw new Error(`No item with id ${id}.`);
    }

    return item.key;
  };

  const evenItems = (itemCount: number) =>
    Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index}`,
      label: `Item ${index}`,
    }));

  const openMenu = (
    model: Parameters<typeof navigationMachine.start>[0]['model'],
  ) => {
    const host = navigationMachine.start({ model, options });
    host.send('open', { position: [0, 0] });
    return host;
  };

  const openEvenMenu = (itemCount: number) =>
    openMenu(createModel({ items: evenItems(itemCount) }));

  const activeIdOf = (host: ReturnType<typeof startStandalone>) =>
    host.current.name === 'standalone'
      ? host.current.data.active?.id
      : undefined;

  /**
   Every item some sequence of arrow presses can reach from a freshly opened
   menu, in the order the menu lists them. Each sequence is replayed from a
   new machine, since the arrows are the only way in.
   */
  const reachableIds = (itemCount: number): string[] => {
    const model = createModel({ items: evenItems(itemCount) });
    const reached = new Set<string>();
    const pending: Array<Array<'up' | 'down' | 'left' | 'right'>> = [[]];
    while (pending.length > 0) {
      const presses = pending.shift() ?? [];
      const host = openMenu(model);
      for (const press of presses) {
        host.send(press);
      }

      const id = activeIdOf(host);
      if (id !== undefined) {
        if (reached.has(id)) {
          continue;
        }

        reached.add(id);
      }

      for (const press of ['up', 'down', 'left', 'right'] as const) {
        pending.push([...presses, press]);
      }
    }

    return model.items.map((item) => item.id).filter((id) => reached.has(id));
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

      host.send('dismiss');
      host.send('pointerDown', { position: [0, 0] });
      const startup = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(startup);

      host.send('pointerMove', { position: [100, 0] });
      const expert = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(expert);

      host.send('pointerCancel', { position: [100, 0] });
      openNovice(host);
      const novice = host.current;
      openStandalone(host, [1, 1]);
      expect(host.current).toEqual(novice);
    });

    it('can open again once it was closed', () => {
      const host = startStandalone();

      openStandalone(host);
      host.send('dismiss');
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

      host.send('pointerDown', { position: [0, 0] });
      host.send('pointerMove', { position: [100, 0] });
      host.send('pointerUp', { position: [100, 0] });
      host.send('pointerCancel', { position: [100, 0] });
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
          'up',
          'down',
          'left',
          'right',
          'first',
          'last',
          'activate',
          'back',
          'dismiss',
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
      host.send('dismiss');
      openStandalone(host);
      host.send('first');
      host.send('activate');

      expect(namesOf(outputs)).not.toContain('feedback');
    });
  });

  describe('moving the active item with the keyboard', () => {
    it.each([
      ['right', 'up', 'up'],
      ['right', 'down', 'down'],
      ['right', 'left', 'down'],
      ['down', 'right', 'right'],
      ['down', 'left', 'left'],
      ['down', 'up', 'right'],
      ['left', 'up', 'up'],
      ['left', 'down', 'down'],
      ['left', 'right', 'down'],
      ['up', 'right', 'right'],
      ['up', 'left', 'left'],
      ['up', 'down', 'right'],
    ] as const)(
      'goes from %s to %s on the %s item',
      (from, direction, expected) => {
        const host = startStandalone();
        openStandalone(host);
        host.send('focus', { key: keyOf(from) });

        host.send(direction);

        expect(activeKeyOf(host)).toBe(keyOf(expected));
      },
    );

    it('takes the first press to the item nearest that direction, with nothing active yet', () => {
      const host = startStandalone();
      openStandalone(host);

      host.send('left');

      expect(activeKeyOf(host)).toBe(leftItem.key);
    });

    it('declines a press with no item further that way, announcing nothing', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: upItem.key });
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);

      host.send('up');

      expect(activeKeyOf(host)).toBe(upItem.key);
      expect(outputs).toEqual([]);
      expect(layouts).toEqual([]);
    });

    it('moves up a five item menu, where no item sits straight up', () => {
      const host = openEvenMenu(5);
      host.send('right');

      host.send('up');
      const afterOne = activeIdOf(host);
      host.send('up');

      expect(afterOne).toBe('item-4');
      expect(activeIdOf(host)).toBe('item-4');
    });

    it('climbs an eight item menu one item at a time, and stops at the top', () => {
      const host = openEvenMenu(8);
      host.send('right');

      const visited: Array<string | undefined> = [];
      for (let index = 0; index < 3; index += 1) {
        host.send('up');
        visited.push(activeIdOf(host));
      }

      expect(visited).toEqual(['item-7', 'item-6', 'item-6']);
    });

    it.each([6, 8])(
      'reaches every item of a %i item menu with the arrows alone',
      (itemCount) => {
        expect(reachableIds(itemCount)).toEqual(
          evenItems(itemCount).map((item) => item.id),
        );
      },
    );

    it('moves both ways in a two item menu', () => {
      const host = openEvenMenu(2);

      host.send('up');
      const afterUp = activeIdOf(host);
      host.send('left');
      const afterLeft = activeIdOf(host);
      host.send('right');

      expect([afterUp, afterLeft, activeIdOf(host)]).toEqual([
        'item-0',
        'item-1',
        'item-0',
      ]);
    });

    it('follows the angles the items were given, not the order they are listed in', () => {
      const host = openMenu(
        createModel({
          items: [
            { id: 'left-ish', label: 'Left-ish', angle: 200 },
            { id: 'up-ish', label: 'Up-ish', angle: 280 },
            { id: 'down-right', label: 'Down-right', angle: 60 },
          ],
        }),
      );

      host.send('up');
      const afterUp = activeIdOf(host);
      host.send('right');

      expect([afterUp, activeIdOf(host)]).toEqual(['up-ish', 'down-right']);
    });

    it('crosses a four item ring in two presses, through the item in between', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });

      host.send('left');
      host.send('left');

      expect(activeKeyOf(host)).toBe(leftItem.key);
    });

    it('goes to the first and last item on first and last', () => {
      const host = startStandalone();
      openStandalone(host);

      host.send('last');
      expect(activeKeyOf(host)).toBe(upItem.key);
      host.send('first');
      expect(activeKeyOf(host)).toBe(rightItem.key);
    });

    it('announces a change, with no pointer position, each time the active item moves', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('right');
      host.send('down');

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

      host.send('right');
      host.send('down');

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
      host.send('right');
      const outputs = recordOutputs(host);

      host.send('up');
      host.send('down');
      host.send('left');
      host.send('right');
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

      host.send('activate');

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

    it('leaves back to the parent, with the submenu item active again', () => {
      const host = startStandalone();
      openStandalone(host, [50, 60]);
      host.send('focus', { key: rightItem.key });
      host.send('activate');
      const outputs = recordOutputs(host);
      const layouts = recordLayouts(host);

      host.send('back');

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
      host.send('right');
      host.send('activate');
      host.send('activate');
      const menus: unknown[] = [];
      host.on('open', ({ data }) => {
        menus.push(data.menu);
      });

      host.send('back');
      host.send('back');

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
      host.send('activate');
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
      host.send('activate');
      const outputs = recordOutputs(host);

      host.send('dismiss');

      expect(host.current.name).toBe('idle');
      expect(namesOf(outputs)).toEqual(['cancel']);
      const event = dataAt(outputs, 0);
      expect(event.mode).toBe('standalone');
      expect(event.position).toBeUndefined();
      expect(event.active).toBe(rightUpItem);
      expect(event.menu).toBe(rightItem);
      expect(event.reason).toBe('dismissed');
      expect(event.recognition).toBeUndefined();
    });

    it('cancels on escape at the root, with nothing active', () => {
      const host = startStandalone();
      openStandalone(host);
      const outputs = recordOutputs(host);

      host.send('back');

      expect(host.current.name).toBe('idle');
      const event = dataAt(outputs, 0);
      expect(namesOf(outputs)).toEqual(['cancel']);
      expect(event.active).toBeUndefined();
      expect(event.menu).toBe(standaloneModel);
      expect(event.reason).toBe('dismissed');
    });

    it('goes back up a level on escape below the root, instead of canceling', () => {
      const host = startStandalone();
      openStandalone(host);
      host.send('focus', { key: rightItem.key });
      host.send('activate');
      const outputs = recordOutputs(host);

      host.send('back');

      expect(host.current.name).toBe('standalone');
      expect(namesOf(outputs)).toEqual(['open', 'change']);
      expect(activeKeyOf(host)).toBe(rightItem.key);
    });
  });

  it('goes back to idle on dispose, from any level', () => {
    const host = startStandalone();
    openStandalone(host);
    host.send('focus', { key: rightItem.key });
    host.send('activate');

    host.send('dispose');

    expect(host.current.name).toBe('idle');
  });
});
