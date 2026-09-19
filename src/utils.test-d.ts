import { describe, expectTypeOf, it } from 'vitest';
import {
  type EmptyTuple,
  type IsTuple,
  type NonEmptyArray,
  type Point,
  type Segment,
} from './utils.js';

/*
 Type level tests: they assert what the type system knows about the type
 utilities exported by `utils.ts`. They are checked by `tsc`, not run.
 */

describe('NonEmptyArray', () => {
  it('requires at least one element', () => {
    const value: NonEmptyArray<number> = [1];
    expectTypeOf(value).toEqualTypeOf<[number, ...number[]]>();

    // @ts-expect-error -- an empty array has no element.
    const empty: NonEmptyArray<number> = [];
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
  it('is a readonly tuple of two numbers', () => {
    const value: Point = [1, 2];
    expectTypeOf(value).toEqualTypeOf<readonly [number, number]>();

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
