import { createMarkingMenu } from 'marking-menu';
import { DEFAULT_MENU, readMenuConfig } from './shared/menu-config.js';

/**
The page's own element matching `selector`, or throws if it's missing.

@param {string} selector - A CSS selector.
@returns {HTMLElement} The matching element.
*/
function element(selector) {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) {
    throw new TypeError(`The demo page is missing ${selector}.`);
  }

  return found;
}

const toastElement = element('#toast');

// The address may name a menu: `?config=` carries one built in the
// playground (see `playground/`), so a link can show the menu it was built
// for. Failing that, the page opens on the shared default.
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

/**
@type {ReturnType<typeof setTimeout> | null}
*/
let toastTimeoutId = null;

/**
Shows `message` in the toast, replacing whatever it was already showing.

@param {string} message - The text to show.
*/
function toastMessage(message) {
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
