import { createMarkingMenu } from 'marking-menu';
import { readMenuConfig } from './menu-config.js';

function element(selector: string): HTMLElement {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) {
    throw new TypeError(`The demo page is missing ${selector}.`);
  }

  return found;
}

const toastElement = element('#toast');

// The demo's own menu, with a sub-menu at the bottom, unless the address
// names one: `?config=` carries a menu built in the playground (see
// `demo/playground`), so a link can show the menu it was built for.
const defaultMenu = {
  items: [
    { label: 'Right' },
    { label: 'Down-Right' },
    {
      label: 'Others...',
      items: [
        { label: 'Sub Right' },
        { label: 'Sub Down' },
        { label: 'Sub Left' },
        { label: 'Sub Up' },
      ],
    },
    { label: 'Down-Left' },
    { label: 'Left' },
    { label: 'Up-Left' },
    { label: 'Up' },
    { label: 'Up-Right' },
  ],
};

const items = readMenuConfig(location.search) ?? defaultMenu;

/**
 Build the menu, taking its stroke colours from the page's own custom
 properties.

 The library reads those colours once, when the menu is created, so this is
 called again whenever the colour scheme changes; everything else on the page
 follows `prefers-color-scheme` in CSS alone.

 @returns The new menu, already listening.
 */
function openMenu() {
  const style = getComputedStyle(document.documentElement);
  const menu = createMarkingMenu({
    ...items,
    parent: element('#main'),
    strokeColor: style.getPropertyValue('--stroke-color').trim(),
    lowerStrokeColor: style.getPropertyValue('--lower-stroke-color').trim(),
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
