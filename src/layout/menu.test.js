import createMenu from './menu.js';

const createModel = (itemNb = 0) => ({
  children: Array.from({ length: itemNb }, (_, i) => ({
    name: `item-${i}-name`,
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
