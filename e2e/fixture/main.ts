import { createMarkingMenu } from 'marking-menu';

// The demo's eight-direction topology (see `demo/script.js`), with stable
// ids added: tests key off `id`, not display order or label text.
const items = [
  { id: 'right', label: 'Right' },
  { id: 'down-right', label: 'Down-Right' },
  {
    id: 'others',
    label: 'Others...',
    items: [
      { id: 'sub-right', label: 'Sub Right' },
      { id: 'sub-down', label: 'Sub Down' },
      { id: 'sub-left', label: 'Sub Left' },
      { id: 'sub-up', label: 'Sub Up' },
    ],
  },
  { id: 'down-left', label: 'Down-Left' },
  { id: 'left', label: 'Left' },
  { id: 'up-left', label: 'Up-Left' },
  { id: 'up', label: 'Up' },
  { id: 'up-right', label: 'Up-Right' },
] as const;

const surface = document.querySelector('#surface');
const log = document.querySelector('#log');
if (!(surface instanceof HTMLElement) || !(log instanceof HTMLElement)) {
  throw new TypeError('Fixture markup is missing #surface or #log.');
}

const mm = createMarkingMenu({ items, notifySteps: true, parent: surface });

// A node carries an `id` only when the caller gave it one (root has none);
// tests need that id, not the whole node, so pull it out defensively.
const idOf = (node: unknown): string | undefined =>
  node !== null &&
  typeof node === 'object' &&
  'id' in node &&
  typeof node.id === 'string'
    ? node.id
    : undefined;

mm.subscribe({
  error(error: unknown) {
    console.error(error);
  },
  next(notification) {
    const entry: Record<string, unknown> = {
      mode: notification.mode,
      type: notification.type,
    };
    if ('selection' in notification) {
      entry.selectionId = idOf(notification.selection);
    }

    if ('active' in notification) {
      entry.activeId = idOf(notification.active);
    }

    if ('menu' in notification) {
      entry.menuId = idOf(notification.menu);
    }

    log.append(`${JSON.stringify(entry)}\n`);
  },
});
