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

/**
 The label-layout solver's ring radius and clearances aren't set from any
 stylesheet under test (`?inline` CSS imports resolve to an empty string
 here). Set them as inline style on `parent` instead, which `main`
 inherits, exactly as it would inherit them from a real stylesheet.
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
  parent.style.setProperty('--menu-radius', `${menuRadius}px`);
  parent.style.setProperty('--item-horizontal-gap', `${horizontalGap}px`);
  parent.style.setProperty('--item-vertical-gap', `${verticalGap}px`);
  parent.style.setProperty('--item-ring-gap', `${ringGap}px`);
  parent.style.setProperty('--item-connector-gap', `${connectorGap}px`);
};

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
    const items = div.querySelectorAll('.marking-menu-item');
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
    const items = div.querySelectorAll('.marking-menu-item');
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

    const items = [...div.querySelectorAll<HTMLElement>('.marking-menu-item')];
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

    const main = div.querySelector('.marking-menu');
    expect(main?.classList.contains('solved')).toBe(true);
    const items = [...div.querySelectorAll<HTMLElement>('.marking-menu-item')];
    expect(items).toHaveLength(8);
    for (const item of items) {
      expect(item.style.getPropertyValue('--x')).not.toBe('');
      expect(item.style.getPropertyValue('--y')).not.toBe('');
      expect(item.style.getPropertyValue('--contact-radius')).not.toBe('');
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

    const main = div.querySelector('.marking-menu');
    expect(main?.classList.contains('solved')).toBe(false);
    const items = [...div.querySelectorAll<HTMLElement>('.marking-menu-item')];
    for (const item of items) {
      expect(item.style.getPropertyValue('--x')).toBe('');
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

    const contactRadius = (parent: HTMLElement): number =>
      // Trailing "px" needs stripping; `Number` alone can't do that.
      // eslint-disable-next-line unicorn/prefer-number-coercion -- see above.
      Number.parseFloat(
        parent
          .querySelector<HTMLElement>('.marking-menu-item')
          ?.style.getPropertyValue('--contact-radius') ?? '',
      );
    expect(contactRadius(wideRing)).toBeGreaterThan(contactRadius(narrowRing));
  });
});
