import { describe, it, expectTypeOf } from 'vitest';
import {
  isNonEmptyArray,
  type SetOptional,
  type Simplify,
  type DeepReadonly,
  type NonEmptyArray,
  type EmptyTuple,
  type EmptyArray,
  type IsTuple,
  type Point,
  type Segment,
} from './utils.js';

/*
 Type level tests: they assert what the type system knows about the type
 utilities exported by `utils.ts`. They are checked by `tsc`, not run.
 */

describe('SetOptional', () => {
  it('makes only the given keys optional, keeping the others required', () => {
    type Original = { a: string; b: number; c: boolean };
    type Result = SetOptional<Original, 'b'>;

    const withoutB: Result = { a: 'hello', c: true };
    expectTypeOf(withoutB.a).toEqualTypeOf<string>();
    expectTypeOf(withoutB.b).toEqualTypeOf<number | undefined>();
    expectTypeOf(withoutB.c).toEqualTypeOf<boolean>();

    // @ts-expect-error -- `a` was not made optional.
    const missingA: Result = { c: true };
    // @ts-expect-error -- `c` was not made optional.
    const missingC: Result = { a: 'hello' };
  });
});

describe('Simplify', () => {
  it('flattens an intersection into a single object type', () => {
    type Result = Simplify<{ a: string } & { b: number }>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
  });
});

describe('DeepReadonly', () => {
  it('makes the properties of an object readonly, recursively', () => {
    type Result = DeepReadonly<{ a: { b: number } }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      readonly a: { readonly b: number };
    }>();
  });

  it('makes array elements readonly, recursively', () => {
    type Result = DeepReadonly<{ items: Array<{ id: string }> }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      readonly items: ReadonlyArray<{ readonly id: string }>;
    }>();
  });

  it('leaves functions untouched', () => {
    type Fn = (x: number) => string;
    expectTypeOf<DeepReadonly<Fn>>().toEqualTypeOf<Fn>();
  });

  it('leaves primitives untouched', () => {
    expectTypeOf<DeepReadonly<string>>().toEqualTypeOf<string>();
    expectTypeOf<DeepReadonly<number>>().toEqualTypeOf<number>();
  });
});

describe('NonEmptyArray', () => {
  it('requires at least one element', () => {
    const value: NonEmptyArray<number> = [1];
    expectTypeOf(value).toEqualTypeOf<[number, ...number[]]>();

    // @ts-expect-error -- an empty array has no element.
    const empty: NonEmptyArray<number> = [];
  });
});

describe('isNonEmptyArray', () => {
  it('narrows a plain array to a NonEmptyArray', () => {
    function narrow(input: number[]): void {
      if (isNonEmptyArray(input)) {
        expectTypeOf(input).toEqualTypeOf<NonEmptyArray<number>>();
      }
    }

    expectTypeOf(narrow).toBeFunction();
  });
});

describe('EmptyTuple', () => {
  it('only accepts an empty, readonly array', () => {
    const value: EmptyTuple = [];
    expectTypeOf(value).toEqualTypeOf<EmptyTuple>();

    // @ts-expect-error -- `EmptyTuple` cannot hold an element.
    const withElement: EmptyTuple = [1];
  });
});

describe('EmptyArray', () => {
  it('only accepts an empty, readonly array', () => {
    const value: EmptyArray = [];
    expectTypeOf(value).toEqualTypeOf<EmptyArray>();

    // @ts-expect-error -- `EmptyArray` cannot hold an element.
    const withElement: EmptyArray = [1];
  });

  it('is not a tuple, unlike EmptyTuple', () => {
    expectTypeOf<IsTuple<EmptyArray>>().toEqualTypeOf<false>();
    expectTypeOf<IsTuple<EmptyTuple>>().toEqualTypeOf<true>();
  });
});

describe('IsTuple', () => {
  it('is true for a type whose length is statically known', () => {
    expectTypeOf<IsTuple<[number, string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTuple<EmptyTuple>>().toEqualTypeOf<true>();
  });

  it('is false for a type whose length is not statically known', () => {
    expectTypeOf<IsTuple<number[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsTuple<readonly number[]>>().toEqualTypeOf<false>();
  });
});

describe('Point', () => {
  it('is a tuple of two numbers', () => {
    const value: Point = [1, 2];
    expectTypeOf(value).toEqualTypeOf<[number, number]>();

    // @ts-expect-error -- a point has exactly two coordinates.
    const missingCoordinate: Point = [1];
  });
});

describe('Segment', () => {
  it('is a tuple of two points', () => {
    const value: Segment = [
      [0, 0],
      [1, 1],
    ];
    expectTypeOf(value).toEqualTypeOf<[Point, Point]>();

    // @ts-expect-error -- a segment has exactly two points.
    const missingPoint: Segment = [[0, 0]];
  });
});
