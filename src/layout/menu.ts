import { at, degreesToRadians, type Point } from '../utils.js';
import { solveLabelLayout } from './label-layout.js';
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
  /**
  The item's key.
  */
  key: string;
  /**
  The item's label.
  */
  label: string;
  /**
  The item's angle, in degrees.
  */
  angle: number;
};

/**
 The menu layout's view of the marking menu model.
 */
export type MenuLayoutModel = {
  /**
  The items of the (sub-)menu to display.
  */
  items: readonly MenuLayoutItem[];
};

/**
 The menu controls.
 */
export type Menu = {
  /**
  The menu's root element, so callers can place it among its siblings.
  */
  element: HTMLElement;
  /**
  Mark the item with the given id as active (or none if nullish).
  */
  setActive: (itemId: string | number | null) => void;
  /**
  Remove the menu.
  */
  remove: () => void;
};

// Items may be styled differently near a corner, so the connecting line meets
// the label squarely. Which corner applies depends on the quadrant the item's
// angle falls in, not on any exact angle: an axis-aligned angle (0, 90, 180,
// 270) sits between two quadrants and gets no corner class. This stays keyed
// on the angle alone, unaffected by the solved layout below: the connector
// always approaches a plate along that same fixed direction, whatever
// tangential offset the solver gave the plate.
const CORNER_ITEM_CLASSES = [
  'bottom-right-item',
  'bottom-left-item',
  'top-left-item',
  'top-right-item',
];

function getCornerClass(angle: number): string | undefined {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  if (normalizedAngle % 90 === 0) {
    return undefined;
  }

  return CORNER_ITEM_CLASSES[Math.floor(normalizedAngle / 90)];
}

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
    const cornerClass = getCornerClass(item.angle);
    if (cornerClass !== undefined) {
      elt.classList.add(cornerClass);
    }

    const radAngle = degreesToRadians(item.angle);
    // Why -radAngle? I got the css math wrong at some point, but it works like
    // this and I could not be bothered fixing it.
    elt.style.setProperty('--cosine', `${Math.cos(-radAngle)}`);
    elt.style.setProperty('--sine', `${Math.sin(-radAngle)}`);
    const lineElt = doc.createElement('div');
    lineElt.className = 'marking-menu-line';
    elt.append(lineElt);

    const labelElt = doc.createElement('div');
    labelElt.className = 'marking-menu-label';
    labelElt.textContent = item.label;
    elt.append(labelElt);
    main.append(elt);
  }

  return main;
};

function readPixels(style: CSSStyleDeclaration, property: string): number {
  // `getPropertyValue` returns the raw declared value (e.g. "80px"); unlike
  // `Number`, `parseFloat` strips that unit suffix instead of yielding NaN.
  // eslint-disable-next-line unicorn/prefer-number-coercion -- see above.
  return Number.parseFloat(style.getPropertyValue(property));
}

/**
 Measure `main`'s rendered label boxes, solve their layout once, and apply
 the result. If the solver reports the menu is oversized, leave `main` as
 `template` built it: every label at the shared fixed radius `menu.css`
 already renders unconditionally, still valid, just not conflict-free.
 */
function applySolvedLayout(
  main: HTMLDivElement,
  items: readonly MenuLayoutItem[],
  doc: Document,
): void {
  const itemElements = [
    ...main.querySelectorAll<HTMLElement>('.marking-menu-item'),
  ];
  const labelElements = itemElements.map((element) => {
    const label = element.querySelector<HTMLElement>('.marking-menu-label');
    if (label === null) {
      throw new Error('Menu item element is missing its label.');
    }

    return label;
  });
  const plates = items.map((item, index) => ({
    angle: item.angle,
    width: at(labelElements, index).offsetWidth,
    height: at(labelElements, index).offsetHeight,
  }));

  const style = (doc.defaultView ?? globalThis).getComputedStyle(main);
  const result = solveLabelLayout({
    plates,
    ringRadius: readPixels(style, '--menu-radius'),
    clearances: {
      plateHorizontal: readPixels(style, '--item-horizontal-gap'),
      plateVertical: readPixels(style, '--item-vertical-gap'),
      plateToRing: readPixels(style, '--item-ring-gap'),
      plateToConnector: readPixels(style, '--item-connector-gap'),
    },
  });
  if (result.status === 'oversized') {
    return;
  }

  main.classList.add('solved');
  for (const [index, element] of itemElements.entries()) {
    const plate = at(result.plates, index);
    element.style.setProperty('--x', `${plate.x}px`);
    element.style.setProperty('--y', `${plate.y}px`);
    element.style.setProperty(
      '--contact-radius',
      `${Math.hypot(...plate.connectorContact)}px`,
    );
  }
}

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
  // Attach before measuring: a detached element's `offsetWidth`/`offsetHeight`
  // are always 0. Everything from here through `applySolvedLayout` runs
  // synchronously in this one call, so the unsolved layout is never
  // painted: a browser only paints between tasks, never mid-function.
  parent.append(main);
  applySolvedLayout(main, model.items, doc);

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
  return { element: main, setActive, remove };
}
