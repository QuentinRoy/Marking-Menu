import { createMarkingMenu } from 'marking-menu';
import {
  centerOf,
  GESTURE_MENU_ITEMS,
  mouseMoveTo,
  mousePressAt,
  mouseReleaseAt,
  offset,
  waitForMenuOpen,
} from './__fixtures__/browser-menu.js';

const SELECT_RADIUS = 100;

test('the built bundle draws every default-theme stroke surface and selects a submenu item', async () => {
  const snapshotArea = document.createElement('div');
  Object.assign(snapshotArea.style, {
    position: 'fixed',
    top: '120px',
    left: '100px',
    width: '600px',
    height: '480px',
  });
  const surface = document.createElement('div');
  Object.assign(surface.style, {
    position: 'absolute',
    top: '30px',
    left: '150px',
    width: '300px',
    height: '300px',
    background: '#fff',
    border: '1px solid #ccc',
  });
  snapshotArea.append(surface);
  document.body.append(snapshotArea);

  const menu = createMarkingMenu({
    parent: surface,
    items: GESTURE_MENU_ITEMS,
  });
  const selections: string[] = [];
  menu.on('select', (event) => {
    selections.push(event.selection.id);
  });
  const center = centerOf(surface);
  const pauseAt = offset(center, 90, SELECT_RADIUS);

  try {
    await mousePressAt(center);
    await mouseMoveTo(pauseAt, 3);
    await waitForMenuOpen(surface);
    await mouseMoveTo(offset(pauseAt, 0, SELECT_RADIUS), 3);

    const root = surface.querySelector('.marking-menu')?.shadowRoot;
    const strokeSelectors = [
      'svg.marking-menu-stroke--lower .marking-menu-stroke-path',
      'svg:not(.marking-menu-stroke--lower) > .marking-menu-stroke-path',
      '.marking-menu-wedge-outline',
      '.marking-menu-item.active .marking-menu-wedge-outline',
    ];
    for (const selector of strokeSelectors) {
      const element = root?.querySelector<SVGElement>(selector);
      if (!element) {
        throw new Error(`Built menu is missing ${selector}.`);
      }

      expect(getComputedStyle(element).stroke).not.toBe('none');
    }

    await expect
      .element(snapshotArea)
      .toMatchScreenshot('built-bundle-default-theme');
    await mouseReleaseAt();
    await expect.poll(() => selections).toEqual(['sub-right']);
  } finally {
    menu.dispose();
    snapshotArea.remove();
  }
});
