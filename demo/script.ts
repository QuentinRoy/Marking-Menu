import { createMarkingMenu } from 'marking-menu';
import { DEFAULT_MENU, readMenuConfig } from './menu-config.js';
import { token } from './tokens.js';

function element(selector: string): HTMLElement {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) {
    throw new TypeError(`The demo page is missing ${selector}.`);
  }

  return found;
}

const toastElement = element('#toast');

// The address may name a menu: `?config=` carries one built in the
// playground (see `demo/playground`), so a link can show the menu it was
// built for. Failing that, the page opens on the shared default.
const items = readMenuConfig(location.search) ?? DEFAULT_MENU;

/**
 Build the menu, taking its stroke colours from the page's own custom
 properties.

 The library reads those colours once, when the menu is created, so this is
 called again whenever the colour scheme changes; everything else on the page
 follows `prefers-color-scheme` in CSS alone.

 @returns The new menu, already listening.
 */
function openMenu() {
  const menu = createMarkingMenu({
    ...items,
    parent: element('#main'),
    strokeColor: token('--stroke-color'),
    lowerStrokeColor: token('--lower-stroke-color'),
  });
  menu.on('select', (event) => {
    toastMessage(event.selection.label);
  });
  return menu;
}

let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
function toastMessage(message: string) {
  if (toastTimeoutId !== null) {
    clearTimeout(toastTimeoutId);
  }

  toastElement.textContent = message;
  toastElement.classList.add('shown');
  toastTimeoutId = setTimeout(() => {
    toastElement.classList.remove('shown');
  }, 1000);
}

let mm = openMenu();
globalThis
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    mm.dispose();
    mm = openMenu();
  });
