import { degreesToRadians, type Point } from '../utils.js';
import menuStyles from './menu.css?inline';

let hasInjectedStyles = false;

/**
 Inject the menu's stylesheet into a document, once.
 */
function ensureStylesInjected(doc: Document): void {
  if (hasInjectedStyles) {
    return;
  }

  hasInjectedStyles = true;
  const style = doc.createElement('style');
  style.textContent = menuStyles;
  doc.head.append(style);
}

/**
 An item of the menu layout's model.
 */
export type MenuLayoutItem = {
  /** The item's key. */
  key: string;
  /** The item's label. */
  label: string;
  /** The item's angle, in degrees. */
  angle: number;
};

/**
 The menu layout's view of the marking menu model.
 */
export type MenuLayoutModel = {
  /** The items of the (sub-)menu to display. */
  items: readonly MenuLayoutItem[];
};

/**
 The menu controls.
 */
export type Menu = {
  /** Mark the item with the given id as active (or none if nullish). */
  setActive: (itemId: string | number | null) => void;
  /** Remove the menu. */
  remove: () => void;
};

// Identify corner items as these may be styled differently.
const CORNER_ITEM_CLASSES: Record<number, string> = {
  45: 'bottom-right-item',
  135: 'bottom-left-item',
  225: 'top-left-item',
  315: 'top-right-item',
};

const template = (
  { items, center }: { items: readonly MenuLayoutItem[]; center: Point },
  doc: Document,
): HTMLDivElement => {
  const main = doc.createElement('div');
  main.className = 'marking-menu';
  main.style.setProperty('--center-x', `${center[0]}px`);
  main.style.setProperty('--center-y', `${center[1]}px`);
  for (const item of items) {
    const elt = doc.createElement('div');
    elt.className = 'marking-menu-item';
    elt.dataset.itemId = item.key;
    elt.style.setProperty('--angle', `${item.angle}deg`);
    const cornerClass = CORNER_ITEM_CLASSES[item.angle];
    if (cornerClass !== undefined) {
      elt.classList.add(cornerClass);
    }

    const radAngle = degreesToRadians(item.angle);
    // Why -radAngle? I got the css math wrong at some point, but it works like
    // this and I could not be bothered fixing it.
    elt.style.setProperty('--cosine', `${Math.cos(-radAngle)}`);
    elt.style.setProperty('--sine', `${Math.sin(-radAngle)}`);
    elt.innerHTML += '<div class="marking-menu-line"></div>';
    elt.innerHTML += `<div class="marking-menu-label">${item.label}</div>`;
    main.append(elt);
  }

  return main;
};

/**
 Create the Menu display.

 @param options - Configuration options.
 @param options.parent - The parent node.
 @param options.model - The model of the menu to open.
 @param options.center - The pixel coordinates where the menu should be
 anchored.
 @param options.doc - The root document of the menu. Mostly useful for testing
 purposes.
 @returns The menu controls.
 */
export function createMenu({
  doc = document,
  parent,
  model,
  center,
}: {
  doc?: Document;
  parent: HTMLElement;
  model: MenuLayoutModel;
  center: Point;
}): Menu {
  ensureStylesInjected(doc);

  // Create the DOM.
  const main = template({ items: model.items, center }, doc);
  parent.append(main);

  // Clear any  active items.
  const clearActiveItems = () => {
    for (const itemDom of main.querySelectorAll('.active')) {
      itemDom.classList.remove('active');
    }
  };

  // Return an item DOM element from its id.
  const getItemDom = (itemId: string | number) =>
    [...main.querySelectorAll<HTMLElement>('.marking-menu-item')].find(
      (elt) => elt.dataset.itemId === itemId,
    );

  // Mark an item as active.
  const setActive = (itemId: string | number | null) => {
    // Clear any  active items.
    clearActiveItems();

    // Set the active class. This mirrors the original truthiness check (which
    // also allowed the numeric id `0`): only `null`, `''`, and `NaN` are
    // skipped.
    if (
      itemId !== null &&
      itemId !== '' &&
      (typeof itemId !== 'number' || !Number.isNaN(itemId))
    ) {
      const itemDom = getItemDom(itemId);
      if (!(itemDom instanceof HTMLElement)) {
        throw new TypeError(`No menu item found for id: ${itemId}`);
      }

      itemDom.classList.add('active');
    }
  };

  // Function to remove the menu.
  const remove = () => {
    main.remove();
  };

  // Create the interface.
  return { setActive, remove };
}
