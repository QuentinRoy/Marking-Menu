import { createModel as createRealModel } from '../../model.js';
import {
  createMenu as createMenuWithResolvedOptions,
  type Menu,
  type MenuEventResolution,
  type MenuLayoutModel,
} from '../menu.js';

// The suite below exercises wedge/label layout, not `deadZoneRadius` itself,
// so every call site gets the same default unless it overrides it.
const createMenu = (
  options: Omit<
    Parameters<typeof createMenuWithResolvedOptions>[0],
    'deadZoneRadius'
  > &
    Partial<
      Pick<
        Parameters<typeof createMenuWithResolvedOptions>[0],
        'deadZoneRadius'
      >
    >,
) => createMenuWithResolvedOptions({ deadZoneRadius: 40, ...options });

const createModel = (itemNb = 0): MenuLayoutModel => ({
  items: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: i * 10,
    key: `item-${i}-key`,
    isLeaf: true,
  })),
});

// Evenly spread, so a solved layout has room to place every label without
// forcing `oversized` at a realistic size.
const createSpreadModel = (itemNb: number): MenuLayoutModel => ({
  items: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: (360 / itemNb) * i,
    key: `item-${i}-key`,
    isLeaf: true,
  })),
});

/**
 JSDOM never lays elements out, so `offsetWidth`/`offsetHeight` are always
 0. Stub every element's to a fixed size for the duration of the block.
 */
const stubbedLabelSize = (width: number, height: number): Disposable => {
  const widthSpy = vi
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockReturnValue(width);
  const heightSpy = vi
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockReturnValue(height);
  return {
    [Symbol.dispose]() {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    },
  };
};

const getShadowRoot = (parent: HTMLElement): ShadowRoot => {
  const root =
    parent.querySelector<HTMLElement>('.marking-menu')?.shadowRoot ?? undefined;
  if (root === undefined) {
    throw new Error('Menu shadow root is missing.');
  }

  return root;
};

const getPart = (parent: HTMLElement, selector: string): HTMLElement => {
  const part =
    getShadowRoot(parent).querySelector<HTMLElement>(selector) ?? undefined;
  if (part === undefined) {
    throw new Error(`Menu has nothing matching ${selector}.`);
  }

  return part;
};

const getLayer = (parent: HTMLElement): HTMLElement =>
  getPart(parent, '.marking-menu-layer');

/**
 What the menu resolves an event dispatched on `target` to, read the way a
 listener on `parent` reads it: an event's path only exists while it is
 dispatched.
 */
const resolveOn = (
  menu: Menu,
  parent: HTMLElement,
  target: EventTarget,
): MenuEventResolution => {
  let resolution: MenuEventResolution | undefined;
  parent.addEventListener(
    'ping',
    (event) => {
      resolution = menu.resolve(event);
    },
    { once: true },
  );
  target.dispatchEvent(new Event('ping', { bubbles: true, composed: true }));
  if (resolution === undefined) {
    throw new Error('The event never reached the parent.');
  }

  return resolution;
};

const getItems = (parent: HTMLElement): HTMLElement[] => [
  ...getShadowRoot(parent).querySelectorAll<HTMLElement>('.marking-menu-item'),
];

const getWedges = (parent: HTMLElement): SVGPathElement[] => [
  ...getShadowRoot(parent).querySelectorAll<SVGPathElement>(
    '.marking-menu-wedge',
  ),
];

const itemIdOfWedge = (wedge: SVGPathElement): string | undefined =>
  wedge.closest<HTMLElement>('.marking-menu-item')?.dataset.itemId;

/**
 Vitest resolves the CSS inline import to empty text, so tests supply probe
 widths from inherited test variables.
 */
const withSolverConfig = (
  parent: HTMLElement,
  overrides: Partial<{
    wedgeThickness: number;
    wedgeGap: number;
    wedgeCornerRadius: number;
    horizontalGap: number;
    verticalGap: number;
    ringGap: number;
    connectorGap: number;
  }> = {},
): void => {
  const {
    wedgeThickness = 40,
    wedgeGap = 4,
    wedgeCornerRadius = 4,
    horizontalGap = 14,
    verticalGap = 7,
    ringGap = 12,
    connectorGap = 3,
  } = overrides;
  const properties = {
    'outer-radius': `${40 + wedgeThickness}px`,
    'wedge-thickness': `${wedgeThickness}px`,
    'wedge-gap': `${wedgeGap}px`,
    'wedge-corner-radius': `${wedgeCornerRadius}px`,
    'plate-gap-horizontal': `${horizontalGap}px`,
    'plate-gap-vertical': `${verticalGap}px`,
    'plate-gap-ring': `${ringGap}px`,
    'plate-gap-connector': `${connectorGap}px`,
  };
  for (const [name, value] of Object.entries(properties)) {
    parent.style.setProperty(`--mm-${name}`, value);
  }

  const getComputedStyle = globalThis.getComputedStyle.bind(globalThis);
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element) => {
    const probeClass = [...element.classList].find((className) =>
      className.startsWith('marking-menu-layout-probe--'),
    );
    if (probeClass === undefined) {
      return getComputedStyle(element);
    }

    const name = probeClass.replace('marking-menu-layout-probe--', '');
    const style: Pick<CSSStyleDeclaration, 'width'> = {
      width: properties[name as keyof typeof properties],
    };
    return style as CSSStyleDeclaration;
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMenu', () => {
  it('reuses one stylesheet across open shadow roots', () => {
    const div = document.createElement('div');
    const styles = document.head.querySelectorAll('style').length;
    const menu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });
    const otherMenu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    const root = menu.element.shadowRoot;
    const otherRoot = otherMenu.element.shadowRoot;
    expect(root?.mode).toBe('open');
    expect(root?.querySelector('style')).toBeNull();
    expect(root?.adoptedStyleSheets).toHaveLength(1);
    expect(root?.adoptedStyleSheets[0]).toBe(otherRoot?.adoptedStyleSheets[0]);
    expect(document.head.querySelectorAll('style')).toHaveLength(styles);
    expect(root?.querySelector('.marking-menu-layout-probe')).toBeNull();
  });

  it('keeps shadow elements out of the public styling API', () => {
    const div = document.createElement('div');
    const menu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(menu.element.shadowRoot?.querySelectorAll('[part]')).toHaveLength(0);
  });

  it("labels the menu layer with the model's label, when it has one", () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: { ...createModel(1), label: 'Paste More' },
      center: [30, 50],
      doc: document,
    });

    expect(getLayer(div).ariaLabel).toBe('Paste More');
  });

  it('leaves the menu layer unlabeled when the model has none, such as the root', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(getLayer(div).ariaLabel).toBeNull();
  });

  it('accepts pointer input on its items and wedges only when told to', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
      pointerTarget: true,
    });

    expect(
      getLayer(div).classList.contains('marking-menu--pointer-target'),
    ).toBe(true);
  });

  it('does not accept pointer input by default', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(
      getLayer(div).classList.contains('marking-menu--pointer-target'),
    ).toBe(false);
  });

  it('focuses its menu layer', () => {
    const div = document.createElement('div');
    document.body.append(div);

    try {
      const menu = createMenu({
        parent: div,
        model: createModel(1),
        center: [30, 50],
        doc: document,
      });

      menu.focusMenu();

      expect(getShadowRoot(div).activeElement).toBe(getLayer(div));
    } finally {
      div.remove();
    }
  });

  it('focuses an item by key', () => {
    const div = document.createElement('div');
    document.body.append(div);

    try {
      const menu = createMenu({
        parent: div,
        model: createModel(1),
        center: [30, 50],
        doc: document,
      });

      menu.focusItem('item-0-key');

      expect(getShadowRoot(div).activeElement).toBe(getItems(div)[0]);
    } finally {
      div.remove();
    }
  });

  it('reaches no item with Tab until one is made the tab stop', () => {
    const div = document.createElement('div');
    const menu = createMenu({
      parent: div,
      model: createModel(3),
      center: [30, 50],
      doc: document,
    });

    expect(getItems(div).map((item) => item.tabIndex)).toEqual([-1, -1, -1]);

    menu.remove();
  });

  it('makes exactly one item the tab stop, and moves it', () => {
    const div = document.createElement('div');
    const menu = createMenu({
      parent: div,
      model: createModel(3),
      center: [30, 50],
      doc: document,
    });

    menu.setTabStop('item-1-key');
    expect(getItems(div).map((item) => item.tabIndex)).toEqual([-1, 0, -1]);

    menu.setTabStop('item-2-key');
    expect(getItems(div).map((item) => item.tabIndex)).toEqual([-1, -1, 0]);

    menu.setTabStop(undefined);
    expect(getItems(div).map((item) => item.tabIndex)).toEqual([-1, -1, -1]);

    menu.remove();
  });

  it('focuses the tab stop, or the menu layer while there is none', () => {
    const div = document.createElement('div');
    document.body.append(div);

    try {
      const menu = createMenu({
        parent: div,
        model: createModel(3),
        center: [30, 50],
        doc: document,
      });

      menu.focusTabStop();
      expect(getShadowRoot(div).activeElement).toBe(getLayer(div));

      menu.setTabStop('item-1-key');
      menu.focusTabStop();
      expect(getShadowRoot(div).activeElement).toBe(getItems(div)[1]);
    } finally {
      div.remove();
    }
  });

  it('throws for a tab stop that is not an item of the menu', () => {
    const div = document.createElement('div');
    const menu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(() => {
      menu.setTabStop('nope');
    }).toThrow('nope');

    menu.remove();
  });

  it('resolves an event on part of an item to that item', () => {
    const parent = document.createElement('div');
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [30, 50],
      doc: document,
    });

    const resolution = resolveOn(
      menu,
      parent,
      getPart(
        parent,
        '.marking-menu-item[data-item-id="item-1-key"] .marking-menu-label',
      ),
    );

    expect(resolution).toEqual({ isInside: true, itemKey: 'item-1-key' });
  });

  it('resolves an event on the layer, but not on an item, to no item', () => {
    const parent = document.createElement('div');
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [30, 50],
      doc: document,
    });

    const resolution = resolveOn(menu, parent, getLayer(parent));

    expect(resolution).toEqual({ isInside: true, itemKey: undefined });
  });

  it('resolves an event outside the layer to outside', () => {
    const parent = document.createElement('div');
    const outside = document.createElement('button');
    parent.append(outside);
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [30, 50],
      doc: document,
    });

    expect(resolveOn(menu, parent, outside)).toEqual({ isInside: false });
  });

  it('is inside its items and its host, but not what is beside it', () => {
    const parent = document.createElement('div');
    const outside = document.createElement('button');
    parent.append(outside);
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [30, 50],
      doc: document,
    });

    expect(menu.isInside(getPart(parent, '.marking-menu-item'))).toBe(true);
    expect(menu.isInside(menu.element)).toBe(true);
    expect(menu.isInside(outside)).toBe(false);
  });

  it('creates a menu host in an anchor parent', () => {
    const anchor = document.createElement('a');

    const menu = createMenu({
      parent: anchor,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(menu.element.parentElement).toBe(anchor);
  });

  it('mounts the menu layer into a shadow-root element directly', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const slot = document.createElement('div');
    root.append(slot);

    const menu = createMenu({
      parent: slot,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(root.querySelector('.marking-menu-layer')?.parentNode).toBe(slot);
    expect(menu.element).toBe(host);
    menu.remove();
    expect(slot.children).toHaveLength(0);
    host.remove();
  });

  it('draws a one-item menu as a full annulus without gaps or corners', () => {
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    const [wedge] = getWedges(div);
    expect(wedge?.ownerSVGElement?.getAttribute('viewBox')).toBe(
      '-80 -80 160 160',
    );
    expect(wedge?.getAttribute('d')).not.toContain('A 4 4');
  });

  it('splits a two-item menu at both bisectors', () => {
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      model: {
        items: [0, 180].map((angle, index) => ({
          angle,
          key: `item-${index}-key`,
          label: `item-${index}`,
          isLeaf: true,
        })),
      },
      center: [30, 50],
      doc: document,
    });

    expect(getWedges(div)).toHaveLength(2);
    expect(
      getWedges(div).every((wedge) => {
        const path = wedge.getAttribute('d');
        return (
          path?.includes('A 40 40 0 0 1') === true &&
          path.includes('A 80 80 0 0 0')
        );
      }),
    ).toBe(true);
  });

  it('aligns wedges with the menu angle convention', () => {
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      model: createSpreadModel(4),
      center: [30, 50],
      doc: document,
    });

    const startPoint = (itemId: string): [number, number] => {
      const path = getWedges(div).find(
        (wedge) => itemIdOfWedge(wedge) === itemId,
      );
      const [, x, y] = (path?.getAttribute('d') ?? '').split(' ', 3);
      if (x === undefined || y === undefined) {
        throw new Error('Wedge path has no start point.');
      }

      return [Number(x), Number(y)];
    };

    expect(startPoint('item-1-key')[1]).toBeGreaterThan(0);
    expect(startPoint('item-3-key')[1]).toBeLessThan(0);
  });

  it('omits only a wedge whose gap consumes its angular span', () => {
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      model: {
        items: [0, 10, 20].map((angle, index) => ({
          angle,
          key: `item-${index}-key`,
          label: `item-${index}`,
          isLeaf: true,
        })),
      },
      center: [30, 50],
      doc: document,
    });

    expect(getWedges(div).map((wedge) => itemIdOfWedge(wedge))).toEqual([
      'item-0-key',
      'item-2-key',
    ]);
  });

  it('uses sharp wedge paths when the gap and corner radius are zero', () => {
    const div = document.createElement('div');
    withSolverConfig(div, { wedgeGap: 0, wedgeCornerRadius: 0 });
    createMenu({
      parent: div,
      model: createSpreadModel(3),
      center: [30, 50],
      doc: document,
    });

    expect(getWedges(div)).toHaveLength(3);
    expect(
      getWedges(div).every(
        (wedge) => !wedge.getAttribute('d')?.includes('A 0 0'),
      ),
    ).toBe(true);
  });

  it('can be removed', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      doc: document,
    });
    expect(div.contains(m.element)).toBe(true);
    m.remove();
    expect(div.contains(m.element)).toBe(false);
  });

  it('renders a real model, using its generated keys', () => {
    const model = createRealModel({
      items: [
        { label: 'Right' },
        {
          id: 'bottom',
          label: 'Bottom',
          items: [{ label: 'Sub 1' }, { label: 'Sub 2' }],
        },
      ],
    });
    const div = document.createElement('div');
    const menu = createMenu({
      parent: div,
      model,
      center: [30, 50],
      doc: document,
    });

    const items = getItems(div);
    expect(items.map((elt) => elt.dataset.itemId)).toEqual(
      model.items.map((item) => item.key),
    );

    // Highlighting by key works even for id-less items, and does not collide.
    expect(() => {
      menu.setActive(model.items[0]?.key ?? undefined);
    }).not.toThrow();
  });

  it('solves a conflict-free layout once labels can be measured', () => {
    using _size = stubbedLabelSize(80, 20);
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      model: createSpreadModel(8),
      center: [30, 50],
      doc: document,
    });

    const items = getItems(div);
    expect(items).toHaveLength(8);
    for (const item of items) {
      const plate = item.querySelector<HTMLElement>('.marking-menu-plate');
      const connector = item.querySelector<SVGElement>(
        '.marking-menu-outer-connector',
      );
      expect(plate?.style.getPropertyValue('--layout-left')).not.toBe('');
      expect(plate?.style.getPropertyValue('--layout-top')).not.toBe('');
      expect(plate?.style.getPropertyValue('--layout-bottom')).toBe('auto');
      expect(
        connector?.style.getPropertyValue('--layout-connector-contact-radius'),
      ).not.toBe('');
    }
  });

  it('leaves the fallback rendering unmodified when the solver reports the menu as oversized', () => {
    using _size = stubbedLabelSize(120, 20);
    const div = document.createElement('div');
    withSolverConfig(div);
    createMenu({
      parent: div,
      // Two items a fraction of a degree apart: no shared radius, however
      // large, separates them within the solver's deterministic work limit.
      model: {
        items: [
          { label: 'item-0-name', angle: 0, key: 'item-0-key', isLeaf: true },
          { label: 'item-1-name', angle: 0.3, key: 'item-1-key', isLeaf: true },
        ],
      },
      center: [30, 50],
      doc: document,
    });

    const items = getItems(div);
    for (const item of items) {
      expect(
        item
          .querySelector<HTMLElement>('.marking-menu-plate')
          ?.style.getPropertyValue('--layout-left'),
      ).toBe('');
    }
  });

  it('reads the wedge thickness and clearances from the CSS custom properties in scope', () => {
    using _size = stubbedLabelSize(80, 20);
    const narrowRing = document.createElement('div');
    withSolverConfig(narrowRing, { wedgeThickness: 40 });
    createMenu({
      parent: narrowRing,
      model: createSpreadModel(8),
      center: [30, 50],
      doc: document,
    });

    const wideRing = document.createElement('div');
    withSolverConfig(wideRing, { wedgeThickness: 160 });
    createMenu({
      parent: wideRing,
      model: createSpreadModel(8),
      center: [30, 50],
      doc: document,
    });

    const connectorContactRadius = (parent: HTMLElement): number => {
      const width =
        getItems(parent)[0]
          ?.querySelector<SVGElement>('.marking-menu-outer-connector')
          ?.style.getPropertyValue('--layout-connector-contact-radius') ?? '';

      return Number(width.slice(0, -2));
    };

    expect(connectorContactRadius(wideRing)).toBeGreaterThan(
      connectorContactRadius(narrowRing),
    );
  });
});
