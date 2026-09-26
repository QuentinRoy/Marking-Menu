import {
  centerOf,
  GESTURE_MENU_ITEMS,
  mountMenu,
  mouseMoveTo,
  mousePressAt,
  mouseReleaseAt,
  offset,
  waitForMenuOpen,
} from '../../__tests__/__fixtures__/browser-menu.js';

const SELECT_RADIUS = 100;

const listenForSelections = (menu: ReturnType<typeof mountMenu>) => {
  const selections: Array<string | undefined> = [];
  menu.mm.on('select', (event) => {
    selections.push(event.selection.id);
  });
  return selections;
};

test('a novice mouse gesture opens the menu and selects the item under the pointer', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const selections = listenForSelections(menu);
  const center = centerOf(menu.surface);

  await mousePressAt(center);
  await waitForMenuOpen(menu.surface);
  await mouseMoveTo(offset(center, 0, SELECT_RADIUS), 3);
  await mouseReleaseAt();

  await expect.poll(() => selections).toEqual(['right']);
});

test('a quick expert mouse stroke selects without opening the menu', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const selections = listenForSelections(menu);
  const center = centerOf(menu.surface);

  await mousePressAt(center);
  await mouseMoveTo(offset(center, 0, SELECT_RADIUS), 2);
  const layer = menu.surface
    .querySelector('.marking-menu')
    ?.shadowRoot?.querySelector('.marking-menu-layer');
  expect(layer).toBeNull();
  await mouseReleaseAt();

  await expect.poll(() => selections).toEqual(['right']);
});

test('a mouse gesture prevents the browser pointer default', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  let wasPrevented: boolean | undefined;
  document.addEventListener(
    'pointerdown',
    (event) => {
      wasPrevented = event.defaultPrevented;
    },
    { once: true },
  );

  await mousePressAt(centerOf(menu.surface));
  await expect.poll(() => wasPrevented).toBe(true);
  await waitForMenuOpen(menu.surface);
  await mouseReleaseAt();
});

test('drawing a mouse gesture does not select incidental text', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const incidentalText = document.createElement('span');
  incidentalText.textContent = 'Incidental text';
  Object.assign(incidentalText.style, {
    left: '130px',
    position: 'absolute',
    top: '140px',
  });
  menu.surface.append(incidentalText);
  const center = centerOf(menu.surface);

  await mousePressAt(center);
  await waitForMenuOpen(menu.surface);
  await mouseMoveTo(offset(center, 0, SELECT_RADIUS), 3);
  await mouseReleaseAt();

  expect(globalThis.getSelection()?.toString()).toBe('');
});

test('pointer capture completes recognition after release outside the surface', async () => {
  using menu = mountMenu({ items: GESTURE_MENU_ITEMS });
  const selections = listenForSelections(menu);
  const center = centerOf(menu.surface);
  const bounds = menu.surface.getBoundingClientRect();

  await mousePressAt(center);
  await waitForMenuOpen(menu.surface);
  await mouseMoveTo({ x: bounds.right + 100, y: center.y });
  await mouseReleaseAt();

  await expect.poll(() => selections).toEqual(['right']);
});
