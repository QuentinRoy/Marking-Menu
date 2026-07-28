import { createMarkingMenu, type ReadonlyPoint } from 'marking-menu';
import { shimMarkingMenuEvents } from './event-shim.js';

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

const notifications$ = createMarkingMenu({
  items,
  notifySteps: true,
  parent: surface,
});
const mm = shimMarkingMenuEvents(notifications$);

// A node carries an `id` only when the caller gave it one (root has none);
// tests need that id, not the whole node, so pull it out defensively.
const idOf = (node: unknown): string | undefined =>
  node !== null &&
  typeof node === 'object' &&
  'id' in node &&
  typeof node.id === 'string'
    ? node.id
    : undefined;

const logEvent = (
  event: { readonly mode: string; readonly position: ReadonlyPoint },
  type: string,
  fields: Record<string, string | undefined> = {},
): void => {
  log.append(
    `${JSON.stringify({
      mode: event.mode,
      position: event.position,
      type,
      ...fields,
    })}\n`,
  );
};

mm.addEventListener('start', (event) => {
  logEvent(event, 'start');
});
mm.addEventListener('open', (event) => {
  logEvent(event, 'open', { menuId: idOf(event.menu) });
});
mm.addEventListener('move', (event) => {
  logEvent(event, 'move', {
    activeId: idOf(event.active),
    menuId: idOf(event.menu),
  });
});
mm.addEventListener('change', (event) => {
  logEvent(event, 'change', {
    activeId: idOf(event.active),
    menuId: idOf(event.menu),
  });
});
mm.addEventListener('select', (event) => {
  logEvent(event, 'select', {
    menuId: idOf(event.menu),
    selectionId: idOf(event.selection),
  });
});
mm.addEventListener('cancel', (event) => {
  logEvent(event, 'cancel', {
    activeId: idOf(event.active),
    menuId: idOf(event.menu),
  });
});
