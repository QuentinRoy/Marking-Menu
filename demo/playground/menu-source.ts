import type {
  MarkingMenuInput,
  MarkingMenuItemInput,
} from '../../src/types.js';

/**
 The demo's own eight-direction menu (see `demo/script.js`), used whenever
 the address carries no menu of its own to restore.
 */
export const DEFAULT_MENU: MarkingMenuInput = {
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

/**
 Print a menu as the editor shows it: leaves on one line each, so a level
 reads as a list, and sub-menus opened up, so the tree is visible.

 @param menu - The menu to print.
 @returns The JSON text.
 */
export function formatMenu(menu: MarkingMenuInput): string {
  return `{\n  "items": ${formatItems(menu.items, '  ')}\n}`;
}

function formatItems(
  items: readonly MarkingMenuItemInput[],
  indent: string,
): string {
  if (items.length === 0) {
    return '[]';
  }

  const inner = items
    .map((item) => `${indent}  ${formatItem(item, `${indent}  `)}`)
    .join(',\n');
  return `[\n${inner}\n${indent}]`;
}

function formatItem(item: MarkingMenuItemInput, indent: string): string {
  const fields = [
    ...(item.id === undefined ? [] : [`"id": ${JSON.stringify(item.id)}`]),
    `"label": ${JSON.stringify(item.label)}`,
  ];
  if (item.items === undefined) {
    return `{ ${fields.join(', ')} }`;
  }

  const nested = [
    ...fields,
    `"items": ${formatItems(item.items, `${indent}  `)}`,
  ].join(`,\n${indent}  `);
  return `{\n${indent}  ${nested}\n${indent}}`;
}
