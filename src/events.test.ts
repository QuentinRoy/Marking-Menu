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
type M = typeof menu;

describe('MarkingMenuStartEvent', () => {
  it('carries the mode and position it was constructed with', () => {
    const event = new MarkingMenuStartEvent({ position: [10, 20] });

    expect(event.type).toBe('start');
    expect(event.mode).toBe('startup');
    expect(event.position).toEqual([10, 20]);
  });

  it('exposes its type as a static, matching the instance type', () => {
    expect(MarkingMenuStartEvent.type).toBe('start');

    const event = new MarkingMenuStartEvent({ position: [0, 0] });
    expect(event.type).toBe(MarkingMenuStartEvent.type);
  });

});

describe('MarkingMenuOpenEvent', () => {
  it('carries the menu, its center, and the position it was opened at', () => {
    const event = new MarkingMenuOpenEvent<M>({
      position: [5, 5],
      menu,
      menuCenter: [50, 50],
    });

    expect(event.type).toBe('open');
    expect(event.mode).toBe('novice');
    expect(event.position).toEqual([5, 5]);
    expect(event.menu).toBe(menu);
    expect(event.menuCenter).toEqual([50, 50]);
  });

});

describe('MarkingMenuMoveEvent', () => {
  it('carries the mode, active item and open menu at the time of the move', () => {
    const event = new MarkingMenuMoveEvent<M>({
      mode: 'novice',
      position: [1, 2],
      active: menu.items[0],
      menu,
    });

    expect(event.type).toBe('move');
    expect(event.mode).toBe('novice');
    expect(event.position).toEqual([1, 2]);
    expect(event.active).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows a null active item and a null menu, for startup and expert', () => {
    const event = new MarkingMenuMoveEvent<M>({
      mode: 'expert',
      position: [1, 2],
      active: null,
      menu: null,
    });

    expect(event.mode).toBe('expert');
    expect(event.active).toBeNull();
    expect(event.menu).toBeNull();
  });

});

describe('MarkingMenuChangeEvent', () => {
  it('carries the new and previous active item, and the open menu', () => {
    const event = new MarkingMenuChangeEvent<M>({
      position: [1, 2],
      active: menu.items[1],
      previousActive: menu.items[0],
      menu,
    });

    expect(event.type).toBe('change');
    expect(event.mode).toBe('novice');
    expect(event.active).toBe(menu.items[1]);
    expect(event.previousActive).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows a null active item, for a change onto or off of empty space', () => {
    const event = new MarkingMenuChangeEvent<M>({
      position: [1, 2],
      active: null,
      previousActive: menu.items[0],
      menu,
    });

    expect(event.active).toBeNull();
    expect(event.previousActive).toBe(menu.items[0]);
  });

});

describe('MarkingMenuSelectEvent', () => {
  it('carries the mode, the selected leaf, and the menu it was selected from', () => {
    const event = new MarkingMenuSelectEvent<M>({
      mode: 'novice',
      position: [1, 2],
      selection: menu.items[0],
      menu,
    });

    expect(event.type).toBe('select');
    expect(event.mode).toBe('novice');
    expect(event.selection).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows a null menu, for a selection made in expert mode', () => {
    const event = new MarkingMenuSelectEvent<M>({
      mode: 'expert',
      position: [1, 2],
      selection: menu.items[0],
      menu: null,
    });

    expect(event.mode).toBe('expert');
    expect(event.menu).toBeNull();
  });

});

describe('MarkingMenuCancelEvent', () => {
  it('carries the mode, the active item at abandon time, and the open menu', () => {
    const event = new MarkingMenuCancelEvent<M>({
      mode: 'novice',
      position: [1, 2],
      active: menu.items[0],
      menu,
    });

    expect(event.type).toBe('cancel');
    expect(event.mode).toBe('novice');
    expect(event.active).toBe(menu.items[0]);
    expect(event.menu).toBe(menu);
  });

  it('allows a null active item and a null menu', () => {
    const event = new MarkingMenuCancelEvent<M>({
      mode: 'startup',
      position: [1, 2],
      active: null,
      menu: null,
    });

    expect(event.active).toBeNull();
    expect(event.menu).toBeNull();
  });

});
