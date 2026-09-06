import {
  addItem,
  removeItem,
  setAngle,
  setLabel,
  type BuilderItem,
  type ItemPath,
} from './menu-config.js';

/**
 The tree editor's controls: add, remove, relabel, and set or clear the angle
 of any item, at any depth.
 */
export type TreeEditor = {
  /**
   Replace the edited tree, e.g. after the address bar changed. Rebuilds the
   whole control tree; prefer letting the editor's own edits update
   themselves; see the module comment.
   */
  update(items: readonly BuilderItem[]): void;
};

/**
 Build the recursive item-tree editor.

 A label or angle edit updates `items` and calls `onChange` without
 rebuilding the control tree: the input the caller is typing in already
 shows what they typed, and rebuilding would drop its focus. Adding or
 removing an item does rebuild, since sibling paths shift under it.

 @param options - Configuration options.
 @param options.parent - The element the controls are appended to.
 @param options.items - The tree to edit, initially.
 @param options.onChange - Called with the new tree after every edit.
 @returns The editor controls.
 */
export function createTreeEditor({
  parent,
  items,
  onChange,
}: {
  parent: HTMLElement;
  items: readonly BuilderItem[];
  onChange: (items: readonly BuilderItem[]) => void;
}): TreeEditor {
  let current = items;

  const commit = (
    next: readonly BuilderItem[],
    { rebuild }: { rebuild: boolean },
  ): void => {
    current = next;
    onChange(current);
    if (rebuild) {
      render();
    }
  };

  const renderItemRow = (item: BuilderItem, path: ItemPath): HTMLLIElement => {
    const row = document.createElement('li');
    row.className = 'item-row';

    const controls = document.createElement('div');
    controls.className = 'item-controls';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'item-label';
    labelInput.value = item.label;
    labelInput.setAttribute('aria-label', 'Label');
    labelInput.addEventListener('input', () => {
      commit(setLabel(current, path, labelInput.value), { rebuild: false });
    });

    const angleInput = document.createElement('input');
    angleInput.type = 'number';
    angleInput.className = 'item-angle';
    angleInput.placeholder = 'free';
    angleInput.setAttribute('aria-label', 'Angle in degrees, free if empty');
    if (item.angle !== null) {
      angleInput.value = String(item.angle);
    }

    angleInput.addEventListener('input', () => {
      const raw = angleInput.value.trim();
      if (raw === '') {
        commit(setAngle(current, path, null), { rebuild: false });
        return;
      }

      const angle = Number(raw);
      if (Number.isFinite(angle)) {
        commit(setAngle(current, path, angle), { rebuild: false });
      }
    });

    const freeButton = document.createElement('button');
    freeButton.type = 'button';
    freeButton.className = 'item-free-angle';
    freeButton.textContent = 'Free';
    freeButton.title = 'Clear the angle and let the layout place this item';
    freeButton.addEventListener('click', () => {
      commit(setAngle(current, path, null), { rebuild: true });
    });

    const itemRemoveButton = document.createElement('button');
    itemRemoveButton.type = 'button';
    itemRemoveButton.className = 'item-remove';
    itemRemoveButton.textContent = 'Remove';
    itemRemoveButton.addEventListener('click', () => {
      commit(removeItem(current, path), { rebuild: true });
    });

    controls.append(labelInput, angleInput, freeButton, itemRemoveButton);
    row.append(controls, renderItemList(item.items, path));
    return row;
  };

  const renderItemList = (
    list: readonly BuilderItem[],
    parentPath: ItemPath,
  ): HTMLUListElement => {
    const listElement = document.createElement('ul');
    listElement.className = 'item-list';
    for (const [index, item] of list.entries()) {
      listElement.append(renderItemRow(item, [...parentPath, index]));
    }

    const newItemRow = document.createElement('li');
    newItemRow.className = 'item-add-row';
    const newItemButton = document.createElement('button');
    newItemButton.type = 'button';
    newItemButton.textContent =
      parentPath.length === 0 ? 'Add item' : 'Add sub-item';
    newItemButton.addEventListener('click', () => {
      commit(addItem(current, parentPath), { rebuild: true });
    });
    newItemRow.append(newItemButton);
    listElement.append(newItemRow);
    return listElement;
  };

  const render = (): void => {
    parent.replaceChildren(renderItemList(current, []));
  };

  render();

  return {
    update(next) {
      current = next;
      render();
    },
  };
}
