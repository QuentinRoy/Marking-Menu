import {
  centerOf,
  type Point,
} from '../../../__tests__/__fixtures__/browser-menu.js';
import { createMenu } from '../../../layout/menu.js';
import { createParent } from './parent.js';

/*
 Shared by the standalone session's tests: a parent holding a real menu of a
 leaf and a submenu item, and a button beside it. Parts are found by their
 role, as a screen reader would, rather than by the menu's own markup.
 */
export const createMenuFixture = () => {
  const parentFixture = createParent();
  const { parent } = parentFixture;
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  parent.append(outside);

  const menu = createMenu({
    parent,
    model: {
      items: [
        { key: 'leaf-key', label: 'Leaf', angle: 0, isLeaf: true },
        { key: 'submenu-key', label: 'Submenu', angle: 180, isLeaf: false },
      ],
    },
    // In the middle of the parent, clear of the button in its corner.
    center: [250, 150],
    deadZoneRadius: 10,
    pointerTarget: true,
  });

  const find = (selector: string): HTMLElement => {
    const part =
      menu.element.shadowRoot?.querySelector<HTMLElement>(selector) ??
      undefined;
    if (part === undefined) {
      throw new Error(`Menu has nothing matching ${selector}.`);
    }

    return part;
  };

  return {
    ...parentFixture,
    menu,
    outside,
    layer: find('[role="menu"]'),
    leaf: find('[role="menuitem"]:not([aria-haspopup])'),
    submenu: find('[role="menuitem"][aria-haspopup]'),
  };
};

/**
 Where to point at `element`: its center, or its label's for a menu item,
 which is itself a zero-size anchor. Rounded, so the events it causes report
 it exactly.
 */
export const pointOf = (element: Element): Point => {
  const target = element.querySelector('.marking-menu-label') ?? element;
  const { x, y } = centerOf(target);
  return { x: Math.round(x), y: Math.round(y) };
};
