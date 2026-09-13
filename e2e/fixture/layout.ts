import { createMenu } from '../../src/layout/menu.js';

const surface = document.querySelector('#surface');
if (!(surface instanceof HTMLElement)) {
  throw new TypeError('Fixture markup is missing #surface.');
}

createMenu({
  center: [150, 150],
  model: {
    items: [
      { angle: 0, key: 'right', label: 'Right' },
      { angle: 90, key: 'down', label: 'Down' },
      { angle: 180, key: 'left', label: 'Left' },
      { angle: 270, key: 'up', label: 'Up' },
    ],
  },
  parent: surface,
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
