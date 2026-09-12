import { createMarkingMenu } from 'marking-menu';
import { DEFAULT_MENU, readMenuConfig } from './menu-config.js';

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

function openMenu() {
  const menu = createMarkingMenu({
    ...items,
    parent: element('#main'),
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

openMenu();
