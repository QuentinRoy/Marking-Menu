/**
@import { MarkingMenuInput, MarkingMenuItemInput } from 'marking-menu';
*/

/*
 The menu a link carries, as `?config=<json>`.

 Both pages read it: the demo to open on the menu it names instead of its
 own, the playground to start editing that same menu. It is the JSON the
 playground's editor holds, verbatim, so a link and the editor agree by
 construction and either can be pasted into the other.

 The value is only checked for shape here. The playground validates it
 against `demo/playground/menu-schema.ts`, which is stricter and reports what is
 wrong; this module only has to decide whether there is a menu at all, so
 that the demo can fall back to its own.

 Nothing here imports the library at runtime, only its types: the demo
 resolves `marking-menu` through its import map, and a second copy pulled in
 from a shared module would break `instanceof` and reference equality.
 */

/**
The query parameter both pages read a menu from.
*/
export const CONFIG_PARAM = 'config';

/**
 The eight-direction menu, with a sub-menu at the bottom, that either page
 opens on when the address carries no menu of its own.

 Angles are stated explicitly so each label keeps sitting at its own name's
 direction (see `e2e/tests/deployed-demo.spec.ts`), regardless of the
 model's default spread for unstated angles.

 @type {MarkingMenuInput}
 */
export const DEFAULT_MENU = {
  items: [
    { label: 'Right', angle: 0 },
    { label: 'Down-Right', angle: 45 },
    {
      label: 'Others...',
      angle: 90,
      items: [
        { label: 'Sub Right', angle: 0 },
        { label: 'Sub Down', angle: 90 },
        { label: 'Sub Left', angle: 180 },
        { label: 'Sub Up', angle: 270 },
      ],
    },
    { label: 'Down-Left', angle: 135 },
    { label: 'Left', angle: 180 },
    { label: 'Up-Left', angle: 225 },
    { label: 'Up', angle: 270 },
    { label: 'Up-Right', angle: 315 },
  ],
};

/**
Whether `value` is a plain object, as opposed to `null` or an array.

@param {unknown} value - The value to test.
@returns {value is Record<string, unknown>} Whether it's a plain object.
*/
function isRecord(value) {
  // `typeof null === 'object'`, and parsed JSON can genuinely contain
  // `null`, so plain objects need to be told apart from it here too.
  return (
    typeof value === 'object' &&
    (value ?? undefined) !== undefined &&
    !Array.isArray(value)
  );
}

/**
Parses `value` as a single menu item, recursing into its `items`.

@param {unknown} value - An unvalidated JSON value.
@returns {MarkingMenuItemInput | undefined} The item, or `undefined` if `value`
is not one.
*/
function asItem(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const { angle, id, label, items } = value;
  if (
    typeof label !== 'string' ||
    (angle !== undefined &&
      (typeof angle !== 'number' || !Number.isFinite(angle))) ||
    (id !== undefined && typeof id !== 'string')
  ) {
    return undefined;
  }

  const nested = items === undefined ? [] : asItems(items);
  if (nested === undefined) {
    return undefined;
  }

  return {
    ...(angle !== undefined && { angle }),
    ...(id !== undefined && { id }),
    label,
    ...(items !== undefined && { items: nested }),
  };
}

/**
Parses `value` as an array of menu items.

@param {unknown} value - An unvalidated JSON value.
@returns {MarkingMenuItemInput[] | undefined} The items, or `undefined` if
`value` is not an array of them.
*/
function asItems(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  /**
  @type {MarkingMenuItemInput[]}
  */
  const items = [];
  for (const raw of value) {
    const item = asItem(raw);
    if (item === undefined) {
      return undefined;
    }

    items.push(item);
  }

  return items;
}

/**
Parses `value` as a menu.

@param {unknown} value - An unvalidated JSON value.
@returns {MarkingMenuInput | undefined} The menu, or `undefined` if `value` is
not one.
*/
function asMenu(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const items = asItems(value.items);
  return items === undefined ? undefined : { items };
}

/**
 Read the menu a query string names.

 @param {string} search - A query string, e.g. `location.search`.
 @returns {MarkingMenuInput | undefined} The menu, or `undefined` if the
 parameter is absent or does not hold one.
 */
export function readMenuConfig(search) {
  const encoded = new URLSearchParams(search).get(CONFIG_PARAM) ?? undefined;
  if (encoded === undefined) {
    return undefined;
  }

  try {
    return asMenu(JSON.parse(encoded));
  } catch {
    return undefined;
  }
}

/**
 Put a menu into a query string, leaving any other parameter alone.

 @param {string} search - The query string to update, e.g. `location.search`.
 @param {MarkingMenuInput} menu - The menu to carry.
 @returns {string} The new query string, leading `?` included.
 */
export function writeMenuConfig(search, menu) {
  const parameters = new URLSearchParams(search);
  // `JSON.stringify` with no spacing: the editor pretty-prints for reading,
  // the address carries the same value with nothing to spare.
  parameters.set(CONFIG_PARAM, JSON.stringify(menu));
  return `?${parameters.toString()}`;
}
