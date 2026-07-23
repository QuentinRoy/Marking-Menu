import { degreesToRadians } from '../utils.js';
import menuStyles from './menu.css?inline';

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = menuStyles;
  document.head.append(style);
}

// Identify corner items as these may be styled differently.
const CORNER_ITEM_CLASSES = {
  45: 'bottom-right-item',
  135: 'bottom-left-item',
  225: 'top-left-item',
  315: 'top-right-item',
};

const template = ({ items, center }, doc) => {
  const main = doc.createElement('div');
  main.className = 'marking-menu';
  main.style.setProperty('--center-x', `${center[0]}px`);
  main.style.setProperty('--center-y', `${center[1]}px`);
  for (const item of items) {
    const elt = doc.createElement('div');
    elt.className = 'marking-menu-item';
    elt.dataset.itemId = item.id;
    elt.style.setProperty('--angle', `${item.angle}deg`);
    const cornerClass = CORNER_ITEM_CLASSES[item.angle];
    if (cornerClass) {
      elt.classList.add(cornerClass);
    }

    const radAngle = degreesToRadians(item.angle);
    // Why -radAngle? I got the css math wrong at some point, but it works like
    // this and I could not be bothered fixing it.
    elt.style.setProperty('--cosine', Math.cos(-radAngle));
    elt.style.setProperty('--sine', Math.sin(-radAngle));
    elt.innerHTML += '<div class="marking-menu-line"></div>';
    elt.innerHTML += `<div class="marking-menu-label">${item.name}</div>`;
    main.append(elt);
  }

  return main;
};

/**
 Create the Menu display.
 @param {object} options - Configuration options.
 @param {HTMLElement} options.parent - The parent node.
 @param {ItemModel} options.model - The model of the menu to open.
 @param {[int, int]} options.center - The pixel coordinates where the menu should be anchored.
 @param {string} [options.current] - The currently active item.
 @param {Document} [options.doc=document] - The root document of the menu.
 Mostly useful for testing purposes.
 @returns {{ setActive, remove }} - The menu controls.
 */
export default function createMenu({
  doc = document,
  parent,
  model,
  center,
  current,
}) {
  // Create the DOM.
  const main = template({ items: model.children, center }, doc);
  parent.append(main);

  // Clear any  active items.
  const clearActiveItems = () => {
    for (const itemDom of main.querySelectorAll('.active')) {
      itemDom.classList.remove('active');
    }
  };

  // Return an item DOM element from its id.
  const getItemDom = (itemId) =>
    [...main.querySelectorAll('.marking-menu-item')].find(
      (elt) => elt.dataset.itemId === itemId,
    );

  // Mark an item as active.
  const setActive = (itemId) => {
    // Clear any  active items.
    clearActiveItems();

    // Set the active class.
    if (itemId || itemId === 0) {
      getItemDom(itemId).classList.add('active');
    }
  };

  // Function to remove the menu.
  const remove = () => main.remove();

  // Initialize the menu.
  if (current) {
    setActive(current);
  }

  // Create the interface.
  return { setActive, remove };
}
