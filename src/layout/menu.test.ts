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

/**
 Vitest resolves the CSS inline import to empty text, so tests supply probe
 widths from inherited test variables.
 */
const withSolverConfig = (
  parent: HTMLElement,
  overrides: Partial<{
    menuRadius: number;
    horizontalGap: number;
    verticalGap: number;
    ringGap: number;
    connectorGap: number;
  }> = {},
): void => {
  const {
    menuRadius = 80,
    horizontalGap = 14,
    verticalGap = 7,
    ringGap = 12,
    connectorGap = 3,
  } = overrides;
  const properties = {
    'ring-radius': `${menuRadius}px`,
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
    expect(root?.querySelector('[part~="plate"]')).not.toBeNull();
    expect(root?.querySelector('[part="connector"]')).not.toBeNull();
    expect(root?.querySelector('[part~="label"]')).not.toBeNull();
    expect(root?.querySelector('.marking-menu-layout-probe')).toBeNull();
    expect(
      root?.querySelector('.marking-menu-label')?.getAttribute('part'),
    ).toBe('plate label');

    menu.setActive('item-0-key');
    expect(root?.querySelector('[part~="plate--active"]')).not.toBeNull();
    expect(root?.querySelector('[part~="connector--active"]')).not.toBeNull();
    expect(root?.querySelector('[part~="label--active"]')).not.toBeNull();
  });

  it('identifies corner items', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: {
        items: [45, 135, 225, 315, 90].map((angle, i) => ({
          label: `item-${i}-name`,
          angle,
          key: `item-${i}-key`,
        })),
      },
      center: [30, 50],
      doc: document,
    });
    const items = getItems(div);
    expect((items[0] as Element).classList.contains('bottom-right-item')).toBe(
      true,
    );
    expect((items[1] as Element).classList.contains('bottom-left-item')).toBe(
      true,
    );
    expect((items[2] as Element).classList.contains('top-left-item')).toBe(
      true,
    );
    expect((items[3] as Element).classList.contains('top-right-item')).toBe(
      true,
    );
    expect((items[4] as Element).className).toBe('marking-menu-item');
  });

  it('styles arbitrary angles by the quadrant they fall in', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: {
        items: [10, 100, 190, 280, 0, 90, 180, 270, -10, 370].map(
          (angle, i) => ({
            label: `item-${i}-name`,
            angle,
            key: `item-${i}-key`,
          }),
        ),
      },
      center: [30, 50],
      doc: document,
    });
    const items = getItems(div);
    expect((items[0] as Element).classList.contains('bottom-right-item')).toBe(
      true,
    );
    expect((items[1] as Element).classList.contains('bottom-left-item')).toBe(
      true,
    );
    expect((items[2] as Element).classList.contains('top-left-item')).toBe(
      true,
    );
    expect((items[3] as Element).classList.contains('top-right-item')).toBe(
      true,
    );
    expect((items[4] as Element).className).toBe('marking-menu-item');
    expect((items[5] as Element).className).toBe('marking-menu-item');
    expect((items[6] as Element).className).toBe('marking-menu-item');
    expect((items[7] as Element).className).toBe('marking-menu-item');
    // -10 is equivalent to 350, inside the top-right quadrant.
    expect((items[8] as Element).classList.contains('top-right-item')).toBe(
      true,
    );
    // 370 is equivalent to 10, inside the bottom-right quadrant.
    expect((items[9] as Element).classList.contains('bottom-right-item')).toBe(
      true,
    );
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
      const label = item.querySelector<HTMLElement>('.marking-menu-label');
      const connector = item.querySelector<HTMLElement>('.marking-menu-line');
      expect(label?.style.getPropertyValue('--solved-left')).not.toBe('');
      expect(label?.style.getPropertyValue('--solved-top')).not.toBe('');
      expect(label?.style.getPropertyValue('--solved-bottom')).toBe('auto');
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
          .querySelector<HTMLElement>('.marking-menu-label')
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
          ?.querySelector<HTMLElement>('.marking-menu-line')
          ?.style.getPropertyValue('--solved-connector-contact-radius') ?? '';

      return Number(width.slice(0, -2));
    };

    expect(connectorContactRadius(wideRing)).toBeGreaterThan(
      connectorContactRadius(narrowRing),
    );
  });
});
