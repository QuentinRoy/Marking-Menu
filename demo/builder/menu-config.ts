import type { MarkingMenuItemInput } from '../../src/types.js';

/*
 The menu configuration the builder page edits: a tree of items, each with a
 label, an optional angle, and its own sub-items. Kept separate from the
 library's own `MarkingMenuItemInput` because a free (`null`) angle needs
 representing while the field is being edited, before it is ever passed to
 the library.

 This module also reads and writes that tree as a compact string meant to
 live in the page's URL: readable enough to eyeball and edit by hand, unlike
 a percent-encoded blob of JSON. It is scoped to this page, not a published
 format, and free to change as the controls it backs change.
 */

/**
 One item of the tree the builder page edits.
 */
export type BuilderItem = {
  readonly label: string;
  /**
  The item's angle in degrees, or `null` to leave it free.
  */
  readonly angle: number | null;
  readonly items: readonly BuilderItem[];
};

/**
 A path from the root to an item: the index to follow at each level.
 */
export type ItemPath = readonly number[];

const newItem = (label: string): BuilderItem => ({
  label,
  angle: null,
  items: [],
});

/**
 Add a new, unlabeled free item as the last child of the item at `parentPath`
 (or as a new top-level item, for an empty path).
 */
export function addItem(
  items: readonly BuilderItem[],
  parentPath: ItemPath,
  label = 'New item',
): readonly BuilderItem[] {
  if (parentPath.length === 0) {
    return [...items, newItem(label)];
  }

  const [index, ...rest] = parentPath as [number, ...number[]];
  return items.map((item, i) =>
    i === index ? { ...item, items: addItem(item.items, rest, label) } : item,
  );
}

/**
 Remove the item at `path`.
 */
export function removeItem(
  items: readonly BuilderItem[],
  path: ItemPath,
): readonly BuilderItem[] {
  const [index, ...rest] = path as [number, ...number[]];
  if (rest.length === 0) {
    return items.filter((_, i) => i !== index);
  }

  return items.map((item, i) =>
    i === index ? { ...item, items: removeItem(item.items, rest) } : item,
  );
}

/**
 Replace the label of the item at `path`.
 */
export function setLabel(
  items: readonly BuilderItem[],
  path: ItemPath,
  label: string,
): readonly BuilderItem[] {
  return updateItem(items, path, (item) => ({ ...item, label }));
}

/**
 Set the angle of the item at `path`, or free it with `null`.
 */
export function setAngle(
  items: readonly BuilderItem[],
  path: ItemPath,
  angle: number | null,
): readonly BuilderItem[] {
  return updateItem(items, path, (item) => ({ ...item, angle }));
}

function updateItem(
  items: readonly BuilderItem[],
  path: ItemPath,
  update: (item: BuilderItem) => BuilderItem,
): readonly BuilderItem[] {
  const [index, ...rest] = path as [number, ...number[]];
  return items.map((item, i) => {
    if (i !== index) {
      return item;
    }

    return rest.length === 0
      ? update(item)
      : { ...item, items: updateItem(item.items, rest, update) };
  });
}

/* -------------------------------------------------------------------------- *
 * URL encoding
 * -------------------------------------------------------------------------- */

// Characters left untouched in an encoded label. Everything else, including
// the grammar's own delimiters (`, ( ) @`), is percent-encoded, so the first
// unescaped `,`, `(`, `)` or `@` found while parsing is always structural.
const LABEL_SAFE_CHAR = /[\w!'*\-.~]/v;

// `encodeURIComponent` leaves parentheses unescaped, which is right for a URL
// but wrong here, since they are this grammar's own delimiters.
const FORCE_ESCAPED: Readonly<Record<string, string>> = {
  '(': '%28',
  ')': '%29',
};

function encodeLabel(label: string): string {
  return [...label]
    .map((char) => {
      if (LABEL_SAFE_CHAR.test(char)) {
        return char;
      }

      return FORCE_ESCAPED[char] ?? encodeURIComponent(char);
    })
    .join('');
}

function decodeLabel(encoded: string): string {
  return decodeURIComponent(encoded);
}

/**
 Encode a menu's items as a compact, hand-editable string:
 `label@angle(sub,sub),label`, with the angle and the sub-items both
 optional.
 */
export function encodeMenuConfig(items: readonly BuilderItem[]): string {
  return items.map((item) => encodeMenuItem(item)).join(',');
}

function encodeMenuItem(item: BuilderItem): string {
  const angle = item.angle === null ? '' : `@${item.angle}`;
  const items =
    item.items.length === 0 ? '' : `(${encodeMenuConfig(item.items)})`;
  return `${encodeLabel(item.label)}${angle}${items}`;
}

/**
 Decode a string produced by {@link encodeMenuConfig} back into a menu's
 items, or `null` if it does not describe one, e.g. a hand-edited address
 with mismatched parentheses or a non-numeric angle.
 */
export function decodeMenuConfig(
  encoded: string,
): readonly BuilderItem[] | null {
  if (encoded === '') {
    return [];
  }

  try {
    return parseItems(encoded);
  } catch {
    return null;
  }
}

function parseItems(source: string): BuilderItem[] {
  return source === ''
    ? []
    : splitTopLevel(source).map((token) => parseItem(token));
}

// Split on every comma not nested inside a parenthesized sub-item list.
function splitTopLevel(source: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let start = 0;
  for (const [i, char] of [...source].entries()) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      tokens.push(source.slice(start, i));
      start = i + 1;
    }
  }

  tokens.push(source.slice(start));
  return tokens;
}

function parseItem(token: string): BuilderItem {
  const parenStart = token.indexOf('(');
  if (parenStart === -1) {
    return parseHead(token, []);
  }

  const parenEnd = findMatchingParenEnd(token, parenStart);
  if (parenEnd !== token.length - 1) {
    throw new Error(`Unbalanced parentheses in "${token}".`);
  }

  const children = parseItems(token.slice(parenStart + 1, parenEnd));
  return parseHead(token.slice(0, parenStart), children);
}

function findMatchingParenEnd(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '(') {
      depth += 1;
    } else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function parseHead(head: string, items: BuilderItem[]): BuilderItem {
  const atIndex = head.indexOf('@');
  if (atIndex === -1) {
    return { label: decodeLabel(head), angle: null, items };
  }

  const label = decodeLabel(head.slice(0, atIndex));
  const angleText = head.slice(atIndex + 1);
  const angle = Number(angleText);
  if (!Number.isFinite(angle)) {
    throw new TypeError(`Invalid angle "${angleText}" for item "${label}".`);
  }

  return { label, angle, items };
}

/* -------------------------------------------------------------------------- *
 * Bridge to the library
 * -------------------------------------------------------------------------- */

/**
 A menu item as passed to the library, still carrying the angle
 `MarkingMenuItemInput` does not (yet) declare. The model ignores fields it
 does not know, so shipping it through is harmless today and, the moment the
 library grows angle support, starts working with no change here.
 */
type BuilderItemInput = MarkingMenuItemInput & {
  readonly angle?: number;
};

/**
 Convert this page's editable tree into the shape the library's model
 building expects.
 */
export function toMarkingMenuItems(
  items: readonly BuilderItem[],
): BuilderItemInput[] {
  return items.map((item) => ({
    label: item.label,
    ...(item.angle !== null && { angle: item.angle }),
    ...(item.items.length > 0 && { items: toMarkingMenuItems(item.items) }),
  }));
}
