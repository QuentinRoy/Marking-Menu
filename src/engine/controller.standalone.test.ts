import type {
  MarkingMenuOpenEvent,
  MarkingMenuSelectEvent,
  MarkingMenuStartEvent,
} from '../events.js';
import { createParent, pointer } from './__fixtures__/pointer.js';
import { createController } from './controller.js';

// `vi.fn()` alone infers a value-returning signature, which an event
// listener's `void` return type rejects.
const voidMock = <Arguments extends readonly unknown[]>() =>
  vi.fn<(...args: Arguments) => void>();

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
      /**
      The label of the item holding focus.
      */
      focusedLabel: () =>
        shadowRoot()?.activeElement?.querySelector('.marking-menu-label')
          ?.textContent ?? undefined,
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
    expect(fixture.items()).toHaveLength(4);

    fixture.controller.close();

    expect(fixture.items()).toHaveLength(0);
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

  it('keeps leaving the pointer to the page when a second open() is refused', () => {
    using fixture = setup();
    fixture.controller.open();

    expect(() => {
      fixture.controller.open();
    }).toThrow();

    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
    const started = voidMock<[MarkingMenuStartEvent]>();
    fixture.controller.on('start', started);
    // On an item rather than bare `parent`: a press there is the menu's
    // own, not one an outside press would otherwise dismiss it for.
    fixture
      .items()[0]
      ?.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(started).not.toHaveBeenCalled();
    expect(fixture.items()).toHaveLength(4);
  });

  it('can be opened again once closed', () => {
    using fixture = setup();

    fixture.controller.open();
    fixture.controller.close();
    fixture.controller.open();

    expect(fixture.items()).toHaveLength(4);
  });

  it('takes focus onto the first item, which becomes active', () => {
    using fixture = setup();
    const events = record(fixture.controller);

    fixture.controller.open();

    expect(fixture.focusedLabel()).toBe('Right');
    expect(events).toEqual([
      ['open', 'standalone', undefined],
      ['change', 'standalone', undefined],
    ]);
  });

  it('walks the items with the arrow keys, focus following', () => {
    using fixture = setup();
    fixture.controller.open();

    fixture.press('ArrowDown');
    expect(fixture.focusedLabel()).toBe('Down');
    fixture.press('End');
    expect(fixture.focusedLabel()).toBe('Up');
    fixture.press('ArrowDown');
    expect(fixture.focusedLabel()).toBe('Right');
    fixture.press('ArrowUp');
    expect(fixture.focusedLabel()).toBe('Up');
    fixture.press('Home');
    expect(fixture.focusedLabel()).toBe('Right');
  });

  it('announces one change per key, not one more for the focus it moved', () => {
    using fixture = setup();
    fixture.controller.open();
    const events = record(fixture.controller);

    fixture.press('ArrowDown');

    expect(events).toEqual([['change', 'standalone', undefined]]);
  });

  it('goes down into a submenu and back up, focus following, keeping the center', () => {
    using fixture = setup();
    fixture.controller.open({ position: [10, 20] });
    const centers: unknown[] = [];
    fixture.controller.on('open', (event) => {
      centers.push(event.menuCenter);
    });

    fixture.press('Enter');
    expect(fixture.items()).toHaveLength(2);
    expect(fixture.focusedLabel()).toBe('Right Up');

    fixture.press('Escape');
    expect(fixture.items()).toHaveLength(4);
    expect(fixture.focusedLabel()).toBe('Right');
    expect(centers).toEqual([
      [10, 20],
      [10, 20],
    ]);
  });

  it('selects the leaf on Enter, and gives focus back to where it was', () => {
    using fixture = setup();
    fixture.controller.open();
    const selected: MarkingMenuSelectEvent[] = [];
    fixture.controller.on('select', (event) => {
      selected.push(event);
    });
    fixture.press('ArrowDown');

    fixture.press('Enter');

    expect(selected.map((event) => event.selection.id)).toEqual(['down']);
    expect(selected[0]?.mode).toBe('standalone');
    expect(fixture.items()).toHaveLength(0);
    expect(document.activeElement).toBe(fixture.opener);
  });

  it('cancels on Escape from the root, and gives focus back', () => {
    using fixture = setup();
    fixture.controller.open();
    const events = record(fixture.controller);

    fixture.press('Escape');

    expect(events.map(([type]) => type)).toEqual(['cancel']);
    expect(document.activeElement).toBe(fixture.opener);
  });

  it('backs out of a submenu on Escape instead of canceling', () => {
    using fixture = setup();
    fixture.controller.open();
    fixture.press('Enter');
    const events = record(fixture.controller);

    fixture.press('Escape');

    expect(events.map(([type]) => type)).toEqual(['open', 'change']);
    expect(fixture.items()).toHaveLength(4);
  });

  it('cancels on Tab, leaving Tab to move focus on', () => {
    using fixture = setup();
    fixture.controller.open();

    const event = fixture.press('Tab');

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.items()).toHaveLength(0);
  });

  it('only displays the menu, taking no focus, and leaving a tab stop, with focus: false', () => {
    using fixture = setup();
    const events = record(fixture.controller);

    fixture.controller.open({ focus: false });

    expect(document.activeElement).toBe(fixture.opener);
    expect(events).toEqual([['open', 'standalone', undefined]]);
    expect(fixture.items().map((item) => item.tabIndex)).toEqual([
      0, -1, -1, -1,
    ]);

    fixture.controller.close();
    expect(document.activeElement).toBe(fixture.opener);
  });

  it('follows an item the user focused themselves', () => {
    using fixture = setup();
    fixture.controller.open({ focus: false });
    const events = record(fixture.controller);

    fixture.items()[2]?.focus();

    expect(events).toEqual([['change', 'standalone', undefined]]);
    expect(
      fixture.items().map((item) => item.classList.contains('active')),
    ).toEqual([false, false, true, false]);
  });

  it('leaves the pointer to the page while it is displayed, and takes it back once closed', () => {
    using fixture = setup();
    const started = voidMock<[MarkingMenuStartEvent]>();
    fixture.controller.on('start', started);

    fixture.controller.open();
    // On an item rather than bare `parent`: a press there is the menu's
    // own, not one an outside press would otherwise dismiss it for.
    const down = pointer('pointerdown', {
      clientX: 0,
      clientY: 0,
      cancelable: true,
    });
    fixture.items()[0]?.dispatchEvent(down);

    expect(started).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');

    fixture.controller.close();
    fixture.parent.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(started).toHaveBeenCalledTimes(1);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('none');
  });

  it('takes the pointer back when a selection ends it', () => {
    using fixture = setup();
    fixture.controller.open();
    fixture.press('ArrowDown');
    fixture.press('Enter');

    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('none');
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
      fixture.controller.open({ focus: false });
    });

    fixture.controller.open({ focus: false });
    fixture.controller.close();

    expect(fixture.items()).toHaveLength(4);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
  });

  it('is left alone by the page it sits in: keys pressed outside it do nothing', () => {
    using fixture = setup();
    fixture.controller.open();
    const events = record(fixture.controller);

    fixture.opener.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );

    expect(events).toEqual([]);
  });

  it('is disposed silently, giving back focus, the pointer, and the DOM', () => {
    using fixture = setup();
    fixture.controller.open();
    const events = record(fixture.controller);

    fixture.controller.dispose();

    expect(events).toEqual([]);
    expect(fixture.items()).toHaveLength(0);
    expect(document.activeElement).toBe(fixture.opener);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
  });

  describe('operated with the pointer', () => {
    it('hovering an item makes it active, without moving focus', () => {
      using fixture = setup();
      fixture.controller.open();
      const events = record(fixture.controller);

      fixture
        .items()[1]
        ?.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 0 }));

      expect(
        fixture.items().map((item) => item.classList.contains('active')),
      ).toEqual([false, true, false, false]);
      expect(fixture.focusedLabel()).toBe('Right');
      expect(events).toEqual([['change', 'standalone', [0, 0]]]);
    });

    it('leaving an item for the rest of the layer clears the active one', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 0 }));
      const events = record(fixture.controller);
      const layer = fixture.parent
        .querySelector('.marking-menu')
        ?.shadowRoot?.querySelector('.marking-menu-layer');

      layer?.dispatchEvent(pointer('pointermove', { clientX: 1, clientY: 1 }));

      expect(
        fixture.items().some((item) => item.classList.contains('active')),
      ).toBe(false);
      expect(events).toEqual([['change', 'standalone', [1, 1]]]);
    });

    it('a hover leaving the menu clears the active item', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(pointer('pointermove', { clientX: 0, clientY: 0 }));
      const events = record(fixture.controller);

      fixture.items()[1]?.dispatchEvent(
        pointer('pointerout', {
          clientX: 1,
          clientY: 1,
          relatedTarget: fixture.parent,
        }),
      );

      expect(
        fixture.items().some((item) => item.classList.contains('active')),
      ).toBe(false);
      expect(events).toEqual([['change', 'standalone', [1, 1]]]);
    });

    it('a held press dragged off the menu clears the active item and stays open', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );
      const events = record(fixture.controller);

      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerout', { pointerId: 1, clientX: 1, clientY: 1 }),
        );

      expect(fixture.items()).toHaveLength(4);
      expect(
        fixture.items().some((item) => item.classList.contains('active')),
      ).toBe(false);
      expect(events).toEqual([['change', 'standalone', [1, 1]]]);
    });

    it('a held press released outside the menu dismisses it without restoring focus', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );
      const events = record(fixture.controller);

      document.body.dispatchEvent(
        pointer('pointerup', { pointerId: 1, clientX: 5, clientY: 6 }),
      );

      expect(fixture.items()).toHaveLength(0);
      expect(events).toEqual([['cancel', 'standalone', [5, 6]]]);
      expect(document.activeElement).not.toBe(fixture.opener);
    });

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

    it('a completed press on a leaf selects it and gives focus back', () => {
      using fixture = setup();
      fixture.controller.open();
      const selected: MarkingMenuSelectEvent[] = [];
      fixture.controller.on('select', (event) => {
        selected.push(event);
      });
      const down = pointer('pointerdown', {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      });
      fixture.items()[1]?.dispatchEvent(down);

      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      expect(selected.map((event) => event.selection.id)).toEqual(['down']);
      expect(selected[0]?.source).toBe('pointer');
      expect(fixture.items()).toHaveLength(0);
      expect(document.activeElement).toBe(fixture.opener);
    });

    it('a completed press on a submenu item opens it and focuses the container', () => {
      using fixture = setup();
      fixture.controller.open();
      const events = record(fixture.controller);
      fixture
        .items()[0]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      fixture
        .items()[0]
        ?.dispatchEvent(
          pointer('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      expect(fixture.items()).toHaveLength(2);
      const shadowRoot =
        fixture.parent.querySelector('.marking-menu')?.shadowRoot;
      expect(shadowRoot?.activeElement).toBe(
        shadowRoot?.querySelector('.marking-menu-layer'),
      );
      expect(events.map(([type]) => type)).toEqual(['open', 'change']);
      expect(events[1]).toEqual(['change', 'standalone', [0, 0]]);
    });

    it('a canceled contact clears the active item and stays open', () => {
      using fixture = setup();
      fixture.controller.open();
      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
        );
      const events = record(fixture.controller);

      fixture
        .items()[1]
        ?.dispatchEvent(
          pointer('pointercancel', { pointerId: 1, clientX: 0, clientY: 0 }),
        );

      expect(fixture.items()).toHaveLength(4);
      expect(
        fixture.items().some((item) => item.classList.contains('active')),
      ).toBe(false);
      expect(events).toEqual([['change', 'standalone', [0, 0]]]);
    });

    it('a primary press outside the menu dismisses it without restoring focus', () => {
      using fixture = setup();
      fixture.controller.open();
      const events = record(fixture.controller);

      fixture.parent.dispatchEvent(
        pointer('pointerdown', { clientX: 5, clientY: 6 }),
      );

      expect(fixture.items()).toHaveLength(0);
      expect(events).toEqual([['cancel', 'standalone', [5, 6]]]);
      // Never restored to the original opener, whatever the press left
      // focus on (jsdom, unlike a real browser, leaves it exactly where it
      // was: still the previously active item, now removed from the
      // document).
      expect(document.activeElement).not.toBe(fixture.opener);
    });

    it('an outside press resumes the page pointer for the very next press', () => {
      using fixture = setup();
      const started = voidMock<[MarkingMenuStartEvent]>();
      fixture.controller.on('start', started);
      fixture.controller.open();

      fixture.parent.dispatchEvent(
        pointer('pointerdown', { pointerId: 7, clientX: 5, clientY: 6 }),
      );
      fixture.parent.dispatchEvent(
        pointer('pointerdown', { pointerId: 8, clientX: 1, clientY: 1 }),
      );

      expect(started).toHaveBeenCalledTimes(1);
    });
  });
});
