import { Draft07, type JsonError } from 'json-schema-library';
import type { MarkingMenuInput } from '../../src/types.js';

/*
 The JSON Schema describing `MarkingMenuInput`, the value the editor holds
 and the page hands straight to `createMarkingMenu`. It backs three things at
 once: the editor's squiggles, its completion and hover, and the status line
 under it.

 It is not published with the package, hence no `$id`: there is no URL it
 could be fetched from. Draft-07 is the dialect both `json-schema-library`
 (the validator below) and `codemirror-json-schema` speak.

 It has no `angle`, because the library has none: `src/model.ts` lays every
 item out at `index * (items.length > 4 ? 45 : 90)`. Per-item angles are
 issue #43; `menu-schema.test-d.ts` fails the moment the input type grows a
 field this schema does not have.
 */
export const menuSchema = {
  // The draft-07 dialect is identified by this exact URI: it is a name, not
  // an address to fetch.
  // eslint-disable-next-line unicorn/prefer-https
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Marking menu',
  description:
    'The description of a marking menu, as passed to createMarkingMenu.',
  type: 'object',
  required: ['items'],
  additionalProperties: false,
  properties: {
    items: { $ref: '#/definitions/items' },
  },
  definitions: {
    items: {
      type: 'array',
      description:
        "A level's items, laid out clockwise from the right at a fixed angle each.",
      items: { $ref: '#/definitions/item' },
    },
    item: {
      type: 'object',
      required: ['label'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          description:
            'An identifier of your own, unique across the whole menu. The library never generates one, and only reports it back.',
        },
        label: {
          type: 'string',
          description: 'The text the item is drawn with.',
        },
        items: { $ref: '#/definitions/items' },
      },
    },
  },
} as const;

const draft = new Draft07(menuSchema);

/**
 What {@link validateMenuSource} made of the editor's text: either the menu
 to hand to the library, or the one message the status line shows.
 */
export type MenuSourceResult =
  | { readonly ok: true; readonly menu: MarkingMenuInput }
  | { readonly ok: false; readonly message: string };

/**
 The labels along an error's instance path, so a message can name the item it
 is about rather than the pointer it came from.

 @param pointer - A JSON pointer into the parsed value, e.g. `#/items/2/items/0`.
 @param value - The parsed value the pointer walks.
 @returns One label per `items/<index>` step the pointer takes, in order.
 */
function labelsAlong(pointer: string, value: unknown): string[] {
  const labels: string[] = [];
  let node: unknown = value;
  for (const step of pointer.replace(/^#\/?/v, '').split('/')) {
    if (step === '') {
      continue;
    }

    node =
      Array.isArray(node) && /^\d+$/v.test(step)
        ? node[Number(step)]
        : isRecord(node)
          ? node[step]
          : undefined;
    if (isRecord(node) && typeof node.label === 'string') {
      labels.push(node.label === '' ? '(untitled)' : node.label);
    }
  }

  return labels;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 Rephrase a schema error as a sentence about an item, falling back to the
 validator's own wording (and its pointer) when the error is not inside one.
 */
function describe(error: JsonError, value: unknown): string {
  const labels = labelsAlong(error.data.pointer, value);
  if (labels.length === 0) {
    return error.message;
  }

  // The validator names the place it found the fault by pointer; the labels
  // say the same thing in the reader's own terms, so the pointer goes.
  const message = error.message.replace(/ in `#[^`]*`/v, '');
  return `${labels.join(' › ')}: ${message}`;
}

/**
 Read the editor's text as a menu.

 @param source - The editor's current text.
 @returns The parsed menu, or the message explaining why there is none.
 */
export function validateMenuSource(source: string): MenuSourceResult {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Invalid JSON: ${detail}` };
  }

  const [first] = draft.validate(value);
  if (first !== undefined) {
    return { ok: false, message: describe(first, value) };
  }

  // The schema is what says this value is a `MarkingMenuInput`, so this is
  // the one place the two meet. `menu-schema.test-d.ts` is what keeps the
  // claim true as the library's input type changes.
  return { ok: true, menu: value as MarkingMenuInput };
}
