import type { MarkingMenuOpenEvent } from '../../events.js';
import { createController } from '../controller.js';
import { createParent, pointer } from './__fixtures__/pointer.js';

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
    const parent = createParent();
    parent.getBoundingClientRect = () =>
      ({ left: 100, top: 200, width: 60, height: 40 }) as unknown as DOMRect;
    document.body.append(parent);
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
      parent,
      opener,
      controller,
      items: () => [
        ...(shadowRoot()?.querySelectorAll<HTMLElement>('.marking-menu-item') ??
          []),
      ],
      press(key: string, init: KeyboardEventInit = {}) {
        const target = shadowRoot()?.activeElement ?? parent;
        const event = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
          composed: true,
          ...init,
        });
        target.dispatchEvent(event);
        return event;
      },
      [Symbol.dispose]() {
        controller.dispose();
        parent.remove();
        opener.remove();
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
    expect(opened[0]?.menuCenter).toEqual([130, 220]);
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
    // Relative to the parent, which sits at [100, 200].
    expect(layer?.style.getPropertyValue('--center-x')).toBe('-90px');
    expect(layer?.style.getPropertyValue('--center-y')).toBe('-180px');
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

  it('does not open in the middle of a gesture, and leaves the gesture alone', () => {
    using fixture = setup();
    fixture.parent.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

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
    it('a press still held when the menu closes does not block the next one', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );
      fixture.press('Escape');
      document.body.dispatchEvent(
        pointer('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      fixture.controller.open();
      const events = record(fixture.controller);

      fixture
        .items()[2]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      expect(events).toEqual([['change', 'standalone', [0, 0]]]);
    });

    it('a press held across a reopen does not act on the new menu when released', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );
      const reopen = () => {
        fixture.controller.off('cancel', reopen);
        fixture.controller.open();
      };

      fixture.controller.on('cancel', reopen);
      fixture.press('Escape');
      const events = record(fixture.controller);

      fixture
        .items()[2]
        ?.dispatchEvent(
          pointer('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      expect(events).toEqual([]);
    });
  });
});
