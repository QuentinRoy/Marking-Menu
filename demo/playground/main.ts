import {
  decodeMenuConfig,
  encodeMenuConfig,
  type BuilderItem,
} from './menu-config.js';
import { createMenuLab } from './menu-lab.js';
import { createTreeEditor } from './tree-editor.js';

// The demo's own eight-direction menu (see `demo/script.js`), used whenever
// the address carries no menu of its own to restore.
const DEFAULT_ITEMS: readonly BuilderItem[] = [
  { label: 'Right', angle: null, items: [] },
  { label: 'Down-Right', angle: null, items: [] },
  {
    label: 'Others...',
    angle: null,
    items: [
      { label: 'Sub Right', angle: null, items: [] },
      { label: 'Sub Down', angle: null, items: [] },
      { label: 'Sub Left', angle: null, items: [] },
      { label: 'Sub Up', angle: null, items: [] },
    ],
  },
  { label: 'Down-Left', angle: null, items: [] },
  { label: 'Left', angle: null, items: [] },
  { label: 'Up-Left', angle: null, items: [] },
  { label: 'Up', angle: null, items: [] },
  { label: 'Up-Right', angle: null, items: [] },
];

const treeContainer = document.querySelector('#tree-editor');
const labContainer = document.querySelector('#menu-lab');
if (
  !(treeContainer instanceof HTMLElement) ||
  !(labContainer instanceof HTMLElement)
) {
  throw new TypeError('Playground page is missing #tree-editor or #menu-lab.');
}

const loadFromHash = (): readonly BuilderItem[] => {
  // No `#` at all means a plain visit, not a link to a (possibly empty) menu:
  // `location.hash` reads as the same empty string either way, so the
  // address itself is what's checked here. A menu emptied down to nothing
  // still updates the address to a bare `#`, which is a real (empty) menu to
  // restore, not a plain visit.
  if (!location.href.includes('#')) {
    return DEFAULT_ITEMS;
  }

  return decodeMenuConfig(location.hash.slice(1)) ?? DEFAULT_ITEMS;
};

let items = loadFromHash();

const menuLab = createMenuLab({ parent: labContainer, items });
const treeEditor = createTreeEditor({
  parent: treeContainer,
  items,
  onChange(next) {
    items = next;
    history.replaceState(null, '', `#${encodeMenuConfig(items)}`);
    menuLab.refresh(items);
  },
});

// A hand-edited address, or the back/forward buttons: restore the controls
// and the preview to match, without feeding the change back into itself.
globalThis.addEventListener('hashchange', () => {
  items = loadFromHash();
  treeEditor.update(items);
  menuLab.update(items);
});
