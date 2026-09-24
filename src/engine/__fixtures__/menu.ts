import { createMenu } from '../../layout/menu.js';
import { createParent } from './pointer.js';

/*
 Shared by the standalone sources' tests: a parent holding a real menu of a
 leaf and a submenu item, and a button beside it. Parts are found by their
 role, as a screen reader would, rather than by the menu's own markup.
 */
export const createMenuFixture = () => {
  const parent = createParent();
  const outside = document.createElement('button');
  parent.append(outside);
  document.body.append(parent);

  const menu = createMenu({
    parent,
    model: {
      items: [
        { key: 'leaf-key', label: 'Leaf', angle: 0, isLeaf: true },
        { key: 'submenu-key', label: 'Submenu', angle: 180, isLeaf: false },
      ],
    },
    center: [0, 0],
    deadZoneRadius: 10,
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
    [Symbol.dispose]() {
      parent.remove();
    },
    parent,
    menu,
    outside,
    layer: find('[role="menu"]'),
    leaf: find('[role="menuitem"]:not([aria-haspopup])'),
    submenu: find('[role="menuitem"][aria-haspopup]'),
  };
};
