import { userEvent } from 'vitest/browser';
import { centerOf, press } from '../../__tests__/__fixtures__/browser-menu.js';
import { createModel as createRealModel } from '../../model.js';
import { solveLabelLayout } from '../label-layout.js';
import {
  createMenu as createMenuWithResolvedOptions,
  type Menu,
  type MenuEventResolution,
  type MenuLayoutModel,
} from '../menu.js';
import { validateLabelLayout } from './__fixtures__/label-layout-validator.js';

// Spied on, but still solving: the layout a menu applies is checked against
// the solver's own input and output.
vi.mock('../label-layout.js', { spy: true });

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
 A parent laid out on the page, so its menu is measured and real input can
 reach it.
 */
const mountParent = () => {
  const parent = document.createElement('div');
  Object.assign(parent.style, {
    position: 'fixed',
    left: '100px',
    top: '100px',
    width: '400px',
    height: '400px',
  });
  document.body.append(parent);
  return {
    parent,
    [Symbol.dispose]() {
      parent.remove();
    },
  };
};

/**
 What the menu resolves each `type` event reaching `parent` to, read the way
 a listener on `parent` reads it: an event's path only exists while it is
 dispatched.
 */
const recordResolutions = (
  menu: Menu,
  parent: HTMLElement,
  type: 'pointerdown' | 'keydown',
) => {
  const resolutions: MenuEventResolution[] = [];
  const listener = (event: Event) => {
    resolutions.push(menu.resolve(event));
  };

  parent.addEventListener(type, listener);
  return {
    resolutions,
    [Symbol.dispose]() {
      parent.removeEventListener(type, listener);
    },
  };
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
 Set the menu's own custom properties on `parent`, for its menus to inherit.
 */
const setProperties = (
  parent: HTMLElement,
  properties: Partial<
    Record<'wedge-thickness' | 'wedge-gap' | 'wedge-corner-radius', string>
  >,
): void => {
  for (const [name, value] of Object.entries(properties)) {
    parent.style.setProperty(`--mm-${name}`, value);
  }
};

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

  it('resolves an event on part of an item to that item', async () => {
    using fixture = mountParent();
    const { parent } = fixture;
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [200, 200],
      doc: document,
      pointerTarget: true,
    });
    using recorded = recordResolutions(menu, parent, 'pointerdown');

    await using _drag = await press(
      centerOf(
        getPart(
          parent,
          '.marking-menu-item[data-item-id="item-1-key"] .marking-menu-label',
        ),
      ),
    );

    expect(recorded.resolutions).toEqual([
      { isInside: true, itemKey: 'item-1-key' },
    ]);
  });

  it('resolves an event on the layer, but not on an item, to no item', async () => {
    using fixture = mountParent();
    const { parent } = fixture;
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [200, 200],
      doc: document,
    });
    using recorded = recordResolutions(menu, parent, 'keydown');
    // Only its items take up room on the page, so the layer is reached
    // through focus.
    menu.focusMenu();

    await userEvent.keyboard('a');

    expect(recorded.resolutions).toEqual([
      { isInside: true, itemKey: undefined },
    ]);
  });

  it('resolves an event outside the layer to outside', async () => {
    using fixture = mountParent();
    const { parent } = fixture;
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    parent.append(outside);
    const menu = createMenu({
      parent,
      model: createModel(2),
      center: [200, 200],
      doc: document,
      pointerTarget: true,
    });
    using recorded = recordResolutions(menu, parent, 'pointerdown');

    await using _drag = await press(centerOf(outside));

    expect(recorded.resolutions).toEqual([{ isInside: false }]);
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
    using fixture = mountParent();
    const { parent: div } = fixture;
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
    using fixture = mountParent();
    const { parent: div } = fixture;
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
    using fixture = mountParent();
    const { parent: div } = fixture;
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
    using fixture = mountParent();
    const { parent: div } = fixture;
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
    using fixture = mountParent();
    const { parent: div } = fixture;
    setProperties(div, { 'wedge-gap': '0px', 'wedge-corner-radius': '0px' });
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
    using fixture = mountParent();
    const { parent: div } = fixture;
    vi.mocked(solveLabelLayout).mockClear();
    createMenu({
      parent: div,
      model: createSpreadModel(8),
      center: [200, 200],
      doc: document,
    });

    const [call] = vi.mocked(solveLabelLayout).mock.calls;
    const [solved] = vi.mocked(solveLabelLayout).mock.results;
    if (call === undefined || solved?.type !== 'return') {
      throw new Error('The menu never solved its layout.');
    }

    const [input] = call;
    const result = solved.value;
    // Measured for real, not left at the stylesheet's fallbacks.
    expect(input.plates.every(({ width }) => width > 0)).toBe(true);
    expect(result.oversized).toBe(false);
    expect(validateLabelLayout(input, result)).toEqual({
      valid: true,
      failures: [],
    });

    const items = getItems(div);
    expect(items).toHaveLength(8);
    for (const [index, item] of items.entries()) {
      const plate = item.querySelector<HTMLElement>('.marking-menu-plate');
      const connector = item.querySelector<SVGElement>(
        '.marking-menu-outer-connector',
      );
      const solvedPlate = result.plates[index];
      expect(plate?.style.getPropertyValue('--layout-left')).toBe(
        `${solvedPlate?.x}px`,
      );
      expect(plate?.style.getPropertyValue('--layout-top')).toBe(
        `${solvedPlate?.y}px`,
      );
      expect(plate?.style.getPropertyValue('--layout-bottom')).toBe('auto');
      expect(
        connector?.style.getPropertyValue('--layout-connector-contact-radius'),
      ).not.toBe('');
    }
  });

  it('leaves the fallback rendering unmodified when the solver reports the menu as oversized', () => {
    using fixture = mountParent();
    const { parent: div } = fixture;
    vi.mocked(solveLabelLayout).mockClear();
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
      center: [200, 200],
      doc: document,
    });

    const [solved] = vi.mocked(solveLabelLayout).mock.results;
    expect(solved?.type === 'return' && solved.value.oversized).toBe(true);
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
    using narrowFixture = mountParent();
    const { parent: narrowRing } = narrowFixture;
    setProperties(narrowRing, { 'wedge-thickness': '40px' });
    createMenu({
      parent: narrowRing,
      model: createSpreadModel(8),
      center: [200, 200],
      doc: document,
    });

    using wideFixture = mountParent();
    const { parent: wideRing } = wideFixture;
    setProperties(wideRing, { 'wedge-thickness': '160px' });
    createMenu({
      parent: wideRing,
      model: createSpreadModel(8),
      center: [200, 200],
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
