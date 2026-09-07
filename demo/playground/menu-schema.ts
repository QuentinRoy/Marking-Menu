import { compileSchema, draft2020, type JsonError } from 'json-schema-library';
import type { MarkingMenuInput } from '../../src/types.js';

/*
 The JSON Schema describing `MarkingMenuInput`, the value the editor holds
 and the page hands straight to `createMarkingMenu`. It backs three things at
 once: the editor's squiggles, its completion and hover, and the status line
 under it.

 It is not published with the package, hence no `$id`: there is no URL it
 could be fetched from.

 The schema mirrors every field in `MarkingMenuInput`.
 `menu-schema.test-d.ts` fails when the input type and schema differ.
 */
export const menuSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Marking menu',
  description:
    'The description of a marking menu, as passed to createMarkingMenu.',
  type: 'object',
  required: ['items'],
  additionalProperties: false,
  properties: {
    // 2020-12 lets `$ref` keep its siblings, so each use of a definition can
    // say what it means where it is used, and the editor shows that on hover.
    items: {
      $ref: '#/$defs/items',
      description:
        'The top level of the menu: what a gesture started anywhere on the surface chooses between.',
    },
  },
  $defs: {
    items: {
      type: 'array',
      title: 'Menu level',
      description:
        'One level of the menu. Items appear clockwise in the order listed here.',
      items: { $ref: '#/$defs/item' },
    },
    item: {
      type: 'object',
      title: 'Menu item',
      description:
        'One item of a level. An item with sub-items of its own opens a sub-menu; an item without is a leaf, and selecting it ends the gesture.',
      required: ['label'],
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          title: 'Identifier',
          description:
            'An identifier of your own, unique across the whole menu. The library never generates one: it only carries it back to you on the selection event, so you can tell which item was chosen without matching on the label. Optional.',
        },
        label: {
          type: 'string',
          title: 'Label',
          description:
            'The text drawn on the item, and what a selection reports back. Required.',
        },
        angle: {
          type: 'number',
          title: 'Angle',
          description:
            'A clockwise angle in degrees from the right. Optional. Items without one fill the gaps between stated angles.',
        },
        items: {
          $ref: '#/$defs/items',
          description:
            "The item's own sub-menu, opened by dwelling on the item or by drawing through it. Leave it out for a leaf.",
        },
      },
    },
  },
} as const;

const schemaNode = compileSchema(menuSchema, { drafts: [draft2020] });

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

  const [first] = schemaNode.validate(value).errors;
  if (first !== undefined) {
    return { ok: false, message: describe(first, value) };
  }

  // The schema is what says this value is a `MarkingMenuInput`, so this is
  // the one place the two meet. `menu-schema.test-d.ts` is what keeps the
  // claim true as the library's input type changes.
  return { ok: true, menu: value as MarkingMenuInput };
}

/* -------------------------------------------------------------------------- *
 * Annotations
 * -------------------------------------------------------------------------- */

/**
 The schema as a plain tree, for walking. `as const` gives the type-level
 test literal types, which is the wrong shape for a recursive walk.
 */
type SchemaNode = {
  readonly $ref?: string;
  readonly type?: string;
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly items?: SchemaNode;
};

const schemaTree = menuSchema as unknown as SchemaNode & {
  readonly $defs: Readonly<Record<string, SchemaNode>>;
};

const DEFS_PREFIX = '#/$defs/';

/**
 Follow a node's `$ref`, if it has one. Every reference in this schema is a
 local one into `$defs`, so nothing has to be fetched or cached.
 */
function deref(node: SchemaNode): SchemaNode {
  if (node.$ref?.startsWith(DEFS_PREFIX) !== true) {
    return node;
  }

  return schemaTree.$defs[node.$ref.slice(DEFS_PREFIX.length)] ?? node;
}

/**
 What the schema says about the value at a JSON pointer.
 */
export type SchemaAnnotation = {
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly type: string | undefined;
};

/**
 Look up the schema for a position in the document, and report what it says
 about it.

 The editor's own schema library loses `title` and `description` on its way
 into a property of an array item reached through a `$ref`, which is every
 item of every menu level here. This walks the schema directly instead, so
 the editor can show what the schema actually says.

 A description written beside a `$ref` wins over the one on the definition it
 points at: 2020-12 allows those siblings so that a definition can say what
 it means at each place it is used.

 @param pointer - A JSON pointer into the document, e.g. `#/items/0/label`.
 @returns The annotation, or `null` if the pointer leads nowhere in the
 schema.
 */
export function annotationAt(pointer: string): SchemaAnnotation | null {
  let node: SchemaNode = schemaTree;
  for (const step of pointer.replace(/^#\/?/v, '').split('/')) {
    if (step === '') {
      continue;
    }

    const here = deref(node);
    const next = /^\d+$/v.test(step) ? here.items : here.properties?.[step];
    if (next === undefined) {
      return null;
    }

    node = next;
  }

  const target = deref(node);
  return {
    title: node.title ?? target.title,
    description: node.description ?? target.description,
    type: target.type,
  };
}
