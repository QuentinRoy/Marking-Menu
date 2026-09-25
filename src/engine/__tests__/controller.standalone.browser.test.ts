import { userEvent } from 'vitest/browser';
import {
  centerOf,
  press,
  type Point,
} from '../../__tests__/__fixtures__/browser-menu.js';
import type { MarkingMenuOpenEvent } from '../../events.js';
import { createController } from '../controller.js';
import { createParent } from './__fixtures__/parent.js';

describe('a standalone menu', () => {
  const submenuItems = [
    {
      id: 'right',
      label: 'Right',
      angle: 0,
      items: [
        { id: 'rightUp', label: 'Right Up' },
        { id: 'rightDown', label: 'Right Down' },
      ],
    },
    { id: 'down', label: 'Down' },
    { id: 'left', label: 'Left' },
    { id: 'up', label: 'Up' },
  ] as const;

  /**
   A controller on a parent attached to the document, with an element
   holding focus before the menu opens, and everything cleaned up at the end
   of the block.
   */
  const setup = (config: { readonly noviceDwellingTime?: number } = {}) => {
    const fixture = createParent();
    const { parent } = fixture;
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const controller = createController({
      items: submenuItems,
      parent,
      ...config,
    });
    const shadowRoot = () =>
      parent.querySelector('.marking-menu')?.shadowRoot ?? undefined;
    return {
      ...fixture,
      opener,
      controller,
      /**
       Where to press the item at `index`: on its label, since the item
       itself is a zero-size anchor. Rounded, so events report it exactly.
       */
      itemPoint(index: number): Point {
        const item =
          shadowRoot()?.querySelectorAll('.marking-menu-item')[index];
        const label = item?.querySelector('.marking-menu-label') ?? undefined;
        if (label === undefined) {
          throw new Error(`The menu has no item ${index}.`);
        }

        const { x, y } = centerOf(label);
        return { x: Math.round(x), y: Math.round(y) };
      },
      [Symbol.dispose]() {
        controller.dispose();
        opener.remove();
        fixture[Symbol.dispose]();
      },
    };
  };

  /**
  Record `[type, mode, position?]` of every event, in order.
  */
  const record = (controller: ReturnType<typeof setup>['controller']) => {
    const events: Array<[string, string, unknown?]> = [];
    for (const type of ['open', 'change', 'select', 'cancel'] as const) {
      controller.on(type, (event) => {
        events.push([type, event.mode, event.position]);
      });
    }

    return events;
  };

  it('opens at the center of the parent by default, without a pointer position', () => {
    using fixture = setup();
    const opened: MarkingMenuOpenEvent[] = [];
    fixture.controller.on('open', (event) => {
      opened.push(event);
    });

    fixture.controller.open();

    expect(opened).toHaveLength(1);
    expect(opened[0]?.mode).toBe('standalone');
    expect(opened[0]?.position).toBeUndefined();
    const box = fixture.parent.getBoundingClientRect();
    expect(opened[0]?.menuCenter).toEqual([
      box.left + box.width / 2,
      box.top + box.height / 2,
    ]);
  });

  it.each([
    [undefined, true],
    [{ autoFocus: false }, false],
  ] as const)(
    'reports whether the menu takes focus on the open event (%j)',
    (options, willAutoFocus) => {
      using fixture = setup();
      const opened: MarkingMenuOpenEvent[] = [];
      fixture.controller.on('open', (event) => {
        opened.push(event);
      });

      fixture.controller.open(options);

      expect(opened[0]?.willAutoFocus).toBe(willAutoFocus);
    },
  );

  it('opens at the client position it is given', () => {
    using fixture = setup();
    const opened: MarkingMenuOpenEvent[] = [];
    fixture.controller.on('open', (event) => {
      opened.push(event);
    });

    fixture.controller.open({ position: [10, 20] });

    expect(opened[0]?.menuCenter).toEqual([10, 20]);
    const layer = fixture.parent
      .querySelector('.marking-menu')
      ?.shadowRoot?.querySelector<HTMLElement>('.marking-menu-layer');
    const box = fixture.parent.getBoundingClientRect();
    expect(layer?.style.getPropertyValue('--center-x')).toBe(
      `${10 - box.left}px`,
    );
    expect(layer?.style.getPropertyValue('--center-y')).toBe(
      `${20 - box.top}px`,
    );
  });

  it('displays the root, and removes it once closed, announcing a cancel', () => {
    using fixture = setup();
    const events = record(fixture.controller);

    fixture.controller.open();
    expect(fixture.controller.state).toMatchObject({
      mode: 'standalone',
      menu: { isRoot: true },
    });

    fixture.controller.close();

    expect(fixture.controller.state.mode).toBe('idle');
    expect(events.map(([type]) => type)).toContain('cancel');
    expect(events.at(-1)?.[1]).toBe('standalone');
  });

  it('throws when opened twice, closed while closed, or used after disposal', () => {
    using fixture = setup();

    expect(() => {
      fixture.controller.close();
    }).toThrow();
    fixture.controller.open();
    expect(() => {
      fixture.controller.open();
    }).toThrow();

    fixture.controller.dispose();
    expect(() => {
      fixture.controller.open();
    }).toThrow();
    expect(() => {
      fixture.controller.close();
    }).toThrow();
  });

  it('can be opened again once closed', () => {
    using fixture = setup();

    fixture.controller.open();
    fixture.controller.close();
    fixture.controller.open();

    expect(fixture.controller.state).toMatchObject({
      mode: 'standalone',
      menu: { isRoot: true },
    });
  });

  it('does not open in the middle of a gesture, and leaves the gesture alone', async () => {
    using fixture = setup();
    await using _drag = await press(fixture.at(0, 0));

    expect(() => {
      fixture.controller.open();
    }).toThrow();
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('none');
  });

  it('can be reopened from its own cancel listener, to stay displayed', () => {
    using fixture = setup();
    fixture.controller.on('cancel', () => {
      fixture.controller.open({ autoFocus: false });
    });

    fixture.controller.open({ autoFocus: false });
    fixture.controller.close();

    expect(fixture.controller.state).toMatchObject({
      mode: 'standalone',
      menu: { isRoot: true },
    });
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
  });

  it('is disposed silently, giving back focus, the pointer, and the DOM', () => {
    using fixture = setup();
    fixture.controller.open();
    const events = record(fixture.controller);

    fixture.controller.dispose();

    expect(events).toEqual([]);
    expect(fixture.controller.state.mode).toBe('idle');
    expect(document.activeElement).toBe(fixture.opener);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
  });

  describe('operated with the pointer', () => {
    it('a press still held when the menu closes does not block the next one', async () => {
      using fixture = setup();
      fixture.controller.open();
      const held = await press(fixture.itemPoint(1));
      await userEvent.keyboard('{Escape}');
      await held.release();
      fixture.controller.open();
      const events = record(fixture.controller);

      const next = fixture.itemPoint(2);
      await using _drag = await press(next);

      expect(events).toEqual([['change', 'standalone', [next.x, next.y]]]);
    });

    it('a press held across a reopen does not act on the new menu when released', async () => {
      using fixture = setup();
      fixture.controller.open();
      await using held = await press(fixture.itemPoint(1));
      const reopen = () => {
        fixture.controller.off('cancel', reopen);
        fixture.controller.open();
      };

      fixture.controller.on('cancel', reopen);
      await userEvent.keyboard('{Escape}');
      // Over the new menu, the held press hovers its items like any pointer
      // would: only its release is under test.
      await held.moveTo(fixture.itemPoint(2));
      const events = record(fixture.controller);

      await held.release();

      expect(events).toEqual([]);
    });
  });
});
