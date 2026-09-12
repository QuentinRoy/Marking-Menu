import { createModel as createRealModel } from '../model.js';
import { createMenu, type MenuLayoutModel } from './menu.js';

const createModel = (itemNb = 0): MenuLayoutModel => ({
  items: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: i * 10,
    key: `item-${i}-key`,
  })),
});

// Evenly spread, so a solved layout has room to place every label without
// forcing `oversized` at a realistic size.
const createSpreadModel = (itemNb: number): MenuLayoutModel => ({
  items: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: (360 / itemNb) * i,
    key: `item-${i}-key`,
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
  const root = parent.querySelector<HTMLElement>('.marking-menu')?.shadowRoot;
  if (root === null || root === undefined) {
    throw new Error('Menu shadow root is missing.');
  }

  return root;
};

const getItems = (parent: HTMLElement): HTMLElement[] => [
  ...getShadowRoot(parent).querySelectorAll<HTMLElement>('.marking-menu-item'),
];

const getWedges = (parent: HTMLElement): SVGPathElement[] => [
  ...getShadowRoot(parent).querySelectorAll<SVGPathElement>(
    '.marking-menu-wedge',
  ),
];

/**
 Vitest resolves the CSS inline import to empty text, so tests supply probe
 widths from inherited test variables.
 */
const withSolverConfig = (
  parent: HTMLElement,
  overrides: Partial<{
    menuRadius: number;
    wedgeGap: number;
    wedgeCornerRadius: number;
    horizontalGap: number;
    verticalGap: number;
    ringGap: number;
    connectorGap: number;
  }> = {},
): void => {
  const {
    menuRadius = 80,
    wedgeGap = 4,
    wedgeCornerRadius = 4,
    horizontalGap = 14,
    verticalGap = 7,
    ringGap = 12,
    connectorGap = 3,
  } = overrides;
  const properties = {
    'ring-radius': `${menuRadius}px`,
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
  it('renders', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(6),
      center: [30, 50],
      doc: document,
    });
    m.setActive('item-5-key');
    expect(div).toMatchSnapshot();
  });

  it('renders without active element', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      doc: document,
    });
    expect(div).toMatchSnapshot();
  });

  it('renders inside an open shadow root without adding a document style', () => {
    const div = document.createElement('div');
    const styles = document.head.querySelectorAll('style').length;
    const menu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    const root = menu.element.shadowRoot;
    expect(root?.mode).toBe('open');
    expect(root?.querySelector('style')).not.toBeNull();
    expect(document.head.querySelectorAll('style')).toHaveLength(styles);
    expect(root?.querySelector('[part="plate"]')).not.toBeNull();
    expect(root?.querySelector('[part="inner-connector"]')).not.toBeNull();
    expect(root?.querySelector('[part="outer-connector"]')).not.toBeNull();
    expect(root?.querySelector('[part="label"]')).not.toBeNull();
    expect(root?.querySelector('.marking-menu-layout-probe')).toBeNull();
    expect(
      root?.querySelector('.marking-menu-plate')?.getAttribute('part'),
    ).toBe('plate');
    expect(
      root?.querySelector('.marking-menu-label')?.getAttribute('part'),
    ).toBe('label');

    menu.setActive('item-0-key');
    expect(root?.querySelector('[part~="plate--active"]')).not.toBeNull();
    expect(
      root?.querySelector('[part~="inner-connector--active"]'),
    ).not.toBeNull();
    expect(
      root?.querySelector('[part~="outer-connector--active"]'),
    ).not.toBeNull();
    expect(root?.querySelector('[part~="label--active"]')).not.toBeNull();
  });

  it('reads the stroke theme from probes in the connected shadow root', () => {
    const div = document.createElement('div');
    const values = {
      'stroke-color': 'color(srgb 0.1 0.2 0.3)',
      'stroke-width': '12px',
      'stroke-start-point-radius': '9px',
      'stroke-color-lower': 'color(srgb 0.4 0.5 0.6)',
      'stroke-width-lower': '8px',
      'stroke-start-point-radius-lower': '6px',
      'stroke-color-feedback': 'color(srgb 0.7 0.8 0.9)',
      'stroke-width-feedback': '4px',
      'stroke-color-canceled': 'color(srgb 0.9 0.2 0.1)',
    };
    const getComputedStyle = globalThis.getComputedStyle.bind(globalThis);
    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((element) => {
      const probeClass = [...element.classList].find((className) =>
        className.startsWith('marking-menu-layout-probe--stroke-'),
      );
      if (probeClass === undefined) {
        return getComputedStyle(element);
      }

      const name = probeClass.replace('marking-menu-layout-probe--', '');
      const value = values[name as keyof typeof values];
      const style: Pick<CSSStyleDeclaration, 'color' | 'width'> = {
        color: value,
        width: value,
      };
      return style as CSSStyleDeclaration;
    });

    const menu = createMenu({
      parent: div,
      model: createModel(1),
      center: [30, 50],
      doc: document,
    });

    expect(menu.strokeTheme).toEqual({
      strokeColor: values['stroke-color'],
      strokeWidth: 12,
      strokeStartPointRadius: 9,
      lowerStrokeColor: values['stroke-color-lower'],
      lowerStrokeWidth: 8,
      lowerStrokeStartPointRadius: 6,
      gestureFeedbackStrokeColor: values['stroke-color-feedback'],
      gestureFeedbackStrokeWidth: 4,
      gestureFeedbackCanceledStrokeColor: values['stroke-color-canceled'],
    });
    expect(
      getShadowRoot(div).querySelector('.marking-menu-layout-probe'),
    ).toBeNull();
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

    const root = getShadowRoot(div);
    const ring = root.querySelector<SVGSVGElement>('[part~="ring"]');
    const [wedge] = getWedges(div);
    expect(ring?.getAttribute('viewBox')).toBe('-80 -80 160 160');
    expect(wedge?.getAttribute('part')).toBe('wedge');
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
        (wedge) => wedge.dataset.itemId === itemId,
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
        })),
      },
      center: [30, 50],
      doc: document,
    });

    expect(getWedges(div).map((wedge) => wedge.dataset.itemId)).toEqual([
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

  it('marks the active wedge with a part modifier', () => {
    const div = document.createElement('div');
    withSolverConfig(div);
    const menu = createMenu({
      parent: div,
      model: createSpreadModel(3),
      center: [30, 50],
      doc: document,
    });

    menu.setActive('item-1-key');
    expect(
      getWedges(div)
        .find((wedge) => wedge.dataset.itemId === 'item-1-key')
        ?.getAttribute('part'),
    ).toBe('wedge wedge--active');
  });

  it('update the active element', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      doc: document,
    });
    m.setActive('item-2-key');
    expect(div).toMatchSnapshot();
    m.setActive('item-1-key');
    expect(div).toMatchSnapshot();
  });

  it('can be removed', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      doc: document,
    });
    m.setActive('item-2-key');
    expect(div).toMatchSnapshot();
    m.remove();
    expect(div).toMatchSnapshot();
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
      menu.setActive(model.items[0]?.key ?? null);
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
      const connector = item.querySelector<HTMLElement>(
        '.marking-menu-outer-connector',
      );
      expect(plate?.style.getPropertyValue('--solved-left')).not.toBe('');
      expect(plate?.style.getPropertyValue('--solved-top')).not.toBe('');
      expect(plate?.style.getPropertyValue('--solved-bottom')).toBe('auto');
      expect(
        connector?.style.getPropertyValue('--solved-connector-contact-radius'),
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
          { label: 'item-0-name', angle: 0, key: 'item-0-key' },
          { label: 'item-1-name', angle: 0.3, key: 'item-1-key' },
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
          ?.style.getPropertyValue('--solved-left'),
      ).toBe('');
    }
  });

  it('reads the ring radius and clearances from the CSS custom properties in scope', () => {
    using _size = stubbedLabelSize(80, 20);
    const narrowRing = document.createElement('div');
    withSolverConfig(narrowRing, { menuRadius: 80 });
    createMenu({
      parent: narrowRing,
      model: createSpreadModel(8),
      center: [30, 50],
      doc: document,
    });

    const wideRing = document.createElement('div');
    withSolverConfig(wideRing, { menuRadius: 200 });
    createMenu({
      parent: wideRing,
      model: createSpreadModel(8),
      center: [30, 50],
      doc: document,
    });

    const connectorContactRadius = (parent: HTMLElement): number => {
      const width =
        getItems(parent)[0]
          ?.querySelector<HTMLElement>('.marking-menu-outer-connector')
          ?.style.getPropertyValue('--solved-connector-contact-radius') ?? '';

      return Number(width.slice(0, -2));
    };

    expect(connectorContactRadius(wideRing)).toBeGreaterThan(
      connectorContactRadius(narrowRing),
    );
  });
});
