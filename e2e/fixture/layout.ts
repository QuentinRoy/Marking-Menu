// This fixture tests the layout on its own, which the package does not export.
// eslint-disable-next-line no-restricted-imports
import { createMenu } from '../../src/layout/menu.js';

const surface = document.querySelector('#surface');
if (!(surface instanceof HTMLElement)) {
  throw new TypeError('Fixture markup is missing #surface.');
}

createMenu({
  center: [150, 150],
  model: {
    items: [
      { angle: 0, key: 'right', label: 'Right', isLeaf: true },
      { angle: 90, key: 'down', label: 'Down', isLeaf: true },
      { angle: 180, key: 'left', label: 'Left', isLeaf: true },
      { angle: 270, key: 'up', label: 'Up', isLeaf: true },
    ],
  },
  parent: surface,
  deadZoneRadius: 40,
  pointerTarget: true,
});

surface.addEventListener('pointerdown', (event) => {
  const item = event
    .composedPath()
    .find(
      (target): target is HTMLElement =>
        target instanceof HTMLElement && target.dataset.itemId !== undefined,
    );
  document.documentElement.dataset.hitItemId = item?.dataset.itemId ?? '';
});
