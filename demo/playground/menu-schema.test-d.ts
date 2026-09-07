import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import { describe, expectTypeOf, it } from 'vitest';
import type {
  MarkingMenuInput,
  MarkingMenuItemInput,
} from '../../src/types.js';
import { menuSchema } from './menu-schema.js';

/*
 Type level test: it asserts that the editor's schema still describes the
 library's own `MarkingMenuInput`, so the page cannot go on offering
 completion for a menu the library no longer accepts, nor stay silent about a
 field it has grown. It is checked by `tsc`, not run.

 Adding a field to `MarkingMenuItemInput` fails the key assertion below until
 the schema describes it too. The shape check then carries it through shared
 links in `demo/menu-config.ts`.
 */

/**
 The item schema, minus the `items` that points back at it. `FromSchema`
 cannot follow a `$ref` into the schema it is deriving, so the recursion is
 closed by hand in {@link SchemaItem}, which is what that `$ref` says anyway.
 */
type ItemSchema = Omit<typeof menuSchema.$defs.item, 'properties'> & {
  properties: Omit<typeof menuSchema.$defs.item.properties, 'items'>;
};

type SchemaItem = FromSchema<ItemSchema> & {
  items?: SchemaItem[];
};

type SchemaMenu = { items: SchemaItem[] };

/**
 A menu type as a JSON value carries it: mutable, and with optional fields
 merely absent rather than possibly `undefined`. `MarkingMenuInput` is
 `readonly` throughout and spells its optionals `| undefined`, which no
 schema can say, so the second assertion compares against this instead.
 */
type AsJson<T> =
  T extends ReadonlyArray<infer Element>
    ? Array<AsJson<Element>>
    : T extends Record<string, unknown>
      ? { -readonly [K in keyof T]: AsJson<Exclude<T[K], undefined>> }
      : T;

describe('menuSchema', () => {
  it('is a JSON schema', () => {
    expectTypeOf(menuSchema).toExtend<JSONSchema>();
  });

  it('describes only menus the library accepts', () => {
    expectTypeOf<SchemaMenu>().toExtend<MarkingMenuInput>();
  });

  it('accepts every menu the library does', () => {
    expectTypeOf<AsJson<MarkingMenuInput>>().toExtend<SchemaMenu>();
  });

  it('has an item field for each of the library’s', () => {
    // Assignability alone would not catch this: TypeScript lets an object
    // with an extra property satisfy a closed type, so a new field on
    // `MarkingMenuItemInput` would slip past the two assertions above.
    expectTypeOf<keyof MarkingMenuItemInput>().toEqualTypeOf<
      keyof SchemaItem
    >();
  });
});
