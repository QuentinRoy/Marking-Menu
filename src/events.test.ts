import {
  MarkingMenuCancelEvent,
  MarkingMenuChangeEvent,
  MarkingMenuMoveEvent,
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from './events.js';
import { createModel } from './model.js';

const menu = createModel({
  items: [
    { id: 'right', label: 'Right' },
    { id: 'bottom', label: 'Bottom', items: [{ id: 'sub', label: 'Sub' }] },
  ],
});
type Model = typeof menu;

const recognition = {
  stroke: [
    [0, 0],
    [10, 0],
  ],
  analysis: {
    articulationPoints: [
      [0, 0],
      [10, 0],
    ],
    segments: [
      {
        points: [
          [0, 0],
          [10, 0],
        ],
      },
    ],
  },
} as const;

describe('MarkingMenuStartEvent', () => {
  it('carries the mode and position it was constructed with', () => {
    const event = new MarkingMenuStartEvent({
      mode: 'startup',
      position: [10, 20],
      source: 'gesture',
    });

    expect(event.type).toBe('start');
    expect(event.mode).toBe('startup');
    expect(event.position).toEqual([10, 20]);
  });

  it('exposes its type as a static, matching the instance type', () => {
    expect(MarkingMenuStartEvent.type).toBe('start');

    const event = new MarkingMenuStartEvent({
      mode: 'startup',
      position: [0, 0],
      source: 'gesture',
    });
    expect(event.type).toBe(MarkingMenuStartEvent.type);
  });
});

describe('MarkingMenuOpenEvent', () => {
  it('carries the menu, its center, and the position it was opened at', () => {
    const event = new MarkingMenuOpenEvent<Model>({
      mode: 'novice',
      position: [5, 5],
      source: 'gesture',
      menu,
      menuCenter: [50, 50],
    });

    expect(event.type).toBe('open');
    expect(event.mode).toBe('novice');
    expect(event.position).toEqual([5, 5]);
    expect(event.menu).toBe(menu);
    expect(event.menuCenter).toEqual([50, 50]);
    expect(event.recognition).toBeUndefined();
    expect(event.willAutoFocus).toBe(true);
  });

  it('carries whether the menu takes focus', () => {
    const event = new MarkingMenuOpenEvent<Model>({
      mode: 'standalone',
      position: undefined,
      source: 'api',
      menu,
      menuCenter: [50, 50],
      willAutoFocus: false,
    });

    expect(event.willAutoFocus).toBe(false);
  });

  it('allows an undefined position in standalone mode', () => {
    const event = new MarkingMenuOpenEvent<Model>({
      mode: 'standalone',
      position: undefined,
      source: 'api',
      menu,
      menuCenter: [50, 50],
    });

    expect(event.mode).toBe('standalone');
    expect(event.position).toBeUndefined();
  });

  it('carries the recognition it was constructed with', () => {
    const event = new MarkingMenuOpenEvent<Model>({
      mode: 'novice',
      position: [5, 5],
      source: 'gesture',
      menu,
      menuCenter: [50, 50],
      recognition,
    });

    expect(event.recognition).toBe(recognition);
  });
});

describe('MarkingMenuMoveEvent', () => {
  it('carries the mode, active item and open menu at the time of the move', () => {
    const event = new MarkingMenuMoveEvent<Model>({
      mode: 'novice',
      position: [1, 2],
      source: 'gesture',
      activeItem: menu.items[0],
      menu,
    });

    expect(event.type).toBe('move');
    expect(event.mode).toBe('novice');
    expect(event.position).toEqual([1, 2]);
    expect(event.activeItem).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows an undefined active item and an undefined menu, for startup and expert', () => {
    const event = new MarkingMenuMoveEvent<Model>({
      mode: 'expert',
      position: [1, 2],
      source: 'gesture',
      activeItem: undefined,
      menu: undefined,
    });

    expect(event.mode).toBe('expert');
    expect(event.activeItem).toBeUndefined();
    expect(event.menu).toBeUndefined();
  });
});

describe('MarkingMenuChangeEvent', () => {
  it('carries the new and previous active item, and the open menu', () => {
    const event = new MarkingMenuChangeEvent<Model>({
      mode: 'novice',
      position: [1, 2],
      source: 'gesture',
      activeItem: menu.items[1],
      previousActiveItem: menu.items[0],
      menu,
    });

    expect(event.type).toBe('change');
    expect(event.mode).toBe('novice');
    expect(event.activeItem).toBe(menu.items[1]);
    expect(event.previousActiveItem).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows an undefined position in standalone mode', () => {
    const event = new MarkingMenuChangeEvent<Model>({
      mode: 'standalone',
      position: undefined,
      source: 'keyboard',
      activeItem: menu.items[1],
      previousActiveItem: undefined,
      menu,
    });

    expect(event.mode).toBe('standalone');
    expect(event.position).toBeUndefined();
  });

  it('allows an undefined active item, for a change onto or off of empty space', () => {
    const event = new MarkingMenuChangeEvent<Model>({
      mode: 'novice',
      position: [1, 2],
      source: 'gesture',
      activeItem: undefined,
      previousActiveItem: menu.items[0],
      menu,
    });

    expect(event.activeItem).toBeUndefined();
    expect(event.previousActiveItem).toBe(menu.items[0]);
  });
});

describe('MarkingMenuSelectEvent', () => {
  it('carries the mode, the selected leaf, and the menu it was selected from', () => {
    const event = new MarkingMenuSelectEvent<Model>({
      mode: 'novice',
      position: [1, 2],
      source: 'gesture',
      selection: menu.items[0],
      menu,
    });

    expect(event.type).toBe('select');
    expect(event.mode).toBe('novice');
    expect(event.selection).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows an undefined position in standalone mode', () => {
    const event = new MarkingMenuSelectEvent<Model>({
      mode: 'standalone',
      position: undefined,
      source: 'keyboard',
      selection: menu.items[0],
      menu,
    });

    expect(event.mode).toBe('standalone');
    expect(event.position).toBeUndefined();
    expect(event.recognition).toBeUndefined();
  });

  it('carries the recognition it was constructed with', () => {
    const event = new MarkingMenuSelectEvent<Model>({
      mode: 'expert',
      position: [1, 2],
      source: 'gesture',
      selection: menu.items[0],
      menu: undefined,
      recognition,
    });

    expect(event.recognition).toBe(recognition);
  });

  it('allows an undefined menu, for a selection made in expert mode', () => {
    const event = new MarkingMenuSelectEvent<Model>({
      mode: 'expert',
      position: [1, 2],
      source: 'gesture',
      selection: menu.items[0],
      menu: undefined,
    });

    expect(event.mode).toBe('expert');
    expect(event.menu).toBeUndefined();
  });
});

describe('MarkingMenuCancelEvent', () => {
  it('carries the mode, the active item at abandon time, and the open menu', () => {
    const event = new MarkingMenuCancelEvent<Model>({
      mode: 'novice',
      position: [1, 2],
      source: 'gesture',
      activeItem: menu.items[0],
      menu,
      reason: 'no-selection',
    });

    expect(event.type).toBe('cancel');
    expect(event.mode).toBe('novice');
    expect(event.reason).toBe('no-selection');
    expect(event.activeItem).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows an undefined position in standalone mode', () => {
    const event = new MarkingMenuCancelEvent<Model>({
      mode: 'standalone',
      position: undefined,
      source: 'focus-loss',
      activeItem: undefined,
      menu,
      reason: 'dismissed',
    });

    expect(event.mode).toBe('standalone');
    expect(event.position).toBeUndefined();
    expect(event.source).toBe('focus-loss');
    expect(event.reason).toBe('dismissed');
    expect(event.recognition).toBeUndefined();
  });

  it('carries the recognition of a failed attempt', () => {
    const event = new MarkingMenuCancelEvent<Model>({
      mode: 'expert',
      position: [1, 2],
      source: 'gesture',
      activeItem: undefined,
      menu: undefined,
      reason: 'no-selection',
      recognition,
    });

    expect(event.recognition).toBe(recognition);
  });

  it('allows an undefined active item and an undefined menu', () => {
    const event = new MarkingMenuCancelEvent<Model>({
      mode: 'startup',
      position: [1, 2],
      source: 'gesture',
      activeItem: undefined,
      menu: undefined,
      reason: 'interrupted',
    });

    expect(event.activeItem).toBeUndefined();
    expect(event.menu).toBeUndefined();
  });
});

describe('standalone events', () => {
  const standaloneCancel = (
    source: 'pointer' | 'keyboard',
    position: [number, number] | undefined,
  ) =>
    new MarkingMenuCancelEvent<Model>({
      mode: 'standalone',
      position,
      source,
      activeItem: undefined,
      menu,
      reason: 'dismissed',
    });

  it('rejects a pointer source without a position', () => {
    expect(() => standaloneCancel('pointer', undefined)).toThrow('position');
  });

  it('rejects a position from any other source', () => {
    expect(() => standaloneCancel('keyboard', [1, 2])).toThrow('position');
  });
});
