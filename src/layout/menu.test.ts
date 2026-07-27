import { createModel as createRealModel } from '../model.js';
import { createMenu, type MenuLayoutModel } from './menu.js';

const createModel = (itemNb = 0): MenuLayoutModel => ({
  items: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: i * 10,
    key: `item-${i}-key`,
  })),
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
});
