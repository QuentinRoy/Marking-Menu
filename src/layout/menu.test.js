import createMenu from './menu';

const createModel = (itemNb = 0) => ({
  children: Array.from({ length: itemNb }).map((_, i) => ({
    name: `item-${i}-name`,
    angle: i * 10,
    id: `item-${i}-id`
  }))
});

describe('createMenu', () => {
  it('renders', () => {
    const div = document.createElement('div');
    createMenu(div, createModel(6), [30, 50], 'item-5-id', document);
    expect(div).toMatchSnapshot();
  });

  it('renders without active element', () => {
    const div = document.createElement('div');
    createMenu(div, createModel(4), [30, 50], undefined, document);
    expect(div).toMatchSnapshot();
  });

  it('update the active element', () => {
    const div = document.createElement('div');
    const m = createMenu(div, createModel(4), [30, 50], 'item-2-id', document);
    expect(div).toMatchSnapshot();
    m.setActive('item-1-id');
    expect(div).toMatchSnapshot();
  });

  it('can be removed', () => {
    const div = document.createElement('div');
    const m = createMenu(div, createModel(4), [30, 50], 'item-2-id', document);
    expect(div).toMatchSnapshot();
    m.remove();
    expect(div).toMatchSnapshot();
  });
});
