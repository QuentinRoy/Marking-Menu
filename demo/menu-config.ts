import type { MarkingMenuInput, MarkingMenuItemInput } from '../src/types.js';

/*
 The menu a link carries, as `?config=<json>`.

 Both pages read it: the demo to open on the menu it names instead of its
 own, the playground to start editing that same menu. It is the JSON the
 playground's editor holds, verbatim, so a link and the editor agree by
 construction and either can be pasted into the other.

 The value is only checked for shape here. The playground validates it
 against `demo/playground/menu-schema.ts`, which is stricter and reports
 what is wrong; this module only has to decide whether there is a menu at
 all, so that the demo can fall back to its own.

 Nothing here imports the library at runtime, only its types: the demo
 resolves `marking-menu` through its import map, and a second copy pulled in
 from a shared module would break `instanceof` and reference equality.
 */

/**
The query parameter both pages read a menu from.
*/
export const CONFIG_PARAM = 'config';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asItem(value: unknown): MarkingMenuItemInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, label, items } = value;
  if (
    typeof label !== 'string' ||
    (id !== undefined && typeof id !== 'string')
  ) {
    return null;
  }

  const nested = items === undefined ? [] : asItems(items);
  if (nested === null) {
    return null;
  }

  return {
    ...(id !== undefined && { id }),
    label,
    ...(items !== undefined && { items: nested }),
  };
}

function asItems(value: unknown): MarkingMenuItemInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: MarkingMenuItemInput[] = [];
  for (const raw of value) {
    const item = asItem(raw);
    if (item === null) {
      return null;
    }

    items.push(item);
  }

  return items;
}

function asMenu(value: unknown): MarkingMenuInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const items = asItems(value.items);
  return items === null ? null : { items };
}

/**
 Read the menu a query string names.

 @param search - A query string, e.g. `location.search`.
 @returns The menu, or `null` if the parameter is absent or does not hold
 one.
 */
export function readMenuConfig(search: string): MarkingMenuInput | null {
  const encoded = new URLSearchParams(search).get(CONFIG_PARAM);
  if (encoded === null) {
    return null;
  }

  try {
    return asMenu(JSON.parse(encoded));
  } catch {
    return null;
  }
}

/**
 Put a menu into a query string, leaving any other parameter alone.

 @param search - The query string to update, e.g. `location.search`.
 @param menu - The menu to carry.
 @returns The new query string, leading `?` included.
 */
export function writeMenuConfig(
  search: string,
  menu: MarkingMenuInput,
): string {
  const parameters = new URLSearchParams(search);
  // `JSON.stringify` with no spacing: the editor pretty-prints for reading,
  // the address carries the same value with nothing to spare.
  parameters.set(CONFIG_PARAM, JSON.stringify(menu));
  return `?${parameters.toString()}`;
}
