import createMenu from './menu.js';

const createModel = (itemNb = 0) => ({
  children: Array.from({ length: itemNb }, (_, i) => ({
    label: `item-${i}-name`,
    angle: i * 10,
    id: `item-${i}-id`,
  })),
});

describe('createMenu', () => {
  it('renders', () => {
    const div = document.createElement('div');
    createMenu({
      parent: div,
      model: createModel(6),
      center: [30, 50],
      current: 'item-5-id',
      doc: document,
    });
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
        children: [45, 135, 225, 315, 90].map((angle, i) => ({
          label: `item-${i}-name`,
          angle,
          id: `item-${i}-id`,
        })),
      },
      center: [30, 50],
      doc: document,
    });
    const items = div.querySelectorAll('.marking-menu-item');
    expect(items[0].classList.contains('bottom-right-item')).toBe(true);
    expect(items[1].classList.contains('bottom-left-item')).toBe(true);
    expect(items[2].classList.contains('top-left-item')).toBe(true);
    expect(items[3].classList.contains('top-right-item')).toBe(true);
    expect(items[4].className).toBe('marking-menu-item');
  });

  it('update the active element', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      current: 'item-2-id',
      doc: document,
    });
    expect(div).toMatchSnapshot();
    m.setActive('item-1-id');
    expect(div).toMatchSnapshot();
  });

  it('can be removed', () => {
    const div = document.createElement('div');
    const m = createMenu({
      parent: div,
      model: createModel(4),
      center: [30, 50],
      current: 'item-2-id',
      doc: document,
    });
    expect(div).toMatchSnapshot();
    m.remove();
    expect(div).toMatchSnapshot();
  });
});
