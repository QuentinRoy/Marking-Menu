import { createModel } from '../../model.js';
import { recognizeMarkingMenuStroke } from '../recognize-mm-stroke.js';
import { generateStroke, type Wobble } from './generate-stroke.js';
import { createRandom } from './random.js';

/*
 Builds evenly spaced menus of any breadth and depth, draws a stroke for a
 random path through one, and reports how often the intended leaf comes back.
 This is the sweep the generated stroke corpus runs (see
 `../generated-stroke-corpus.test.ts`); kept here, apart from the test file,
 so both it and `scripts/generate-stroke.ts` can reuse it.

 The menus are built with `createModel` itself, from a plain item list with
 no angle stated, rather than from any hardcoded angle table. A change to how
 `createModel` lays a level out changes what this corpus measures on its next
 run, with nothing here to update by hand.
 */

type EvenItem = { label: string; items?: EvenItem[] };

const buildLevel = (breadth: number, depth: number): EvenItem[] =>
  Array.from({ length: breadth }, (_, index) => ({
    label: `item-${index}`,
    ...(depth > 1 && { items: buildLevel(breadth, depth - 1) }),
  }));

/**
 An evenly spaced menu, `breadth` items per level, `depth` levels deep.

 No explicit return type: `createModel` is generic, and naming its return
 type as `ReturnType<typeof createModel>` collapses to `any` rather than the
 concrete type this specific, non-generic call actually produces.
 */
export const buildMenu = (breadth: number, depth: number) =>
  createModel({ items: buildLevel(breadth, depth) });

/**
 The generic shape {@link randomPath} walks: any node exposing its
 sub-items, and any non-root node also exposing the angle it was laid out
 at. `buildMenu`'s actual, precise return type is always assignable to it.
 */
type WalkableNode = { readonly items: readonly WalkableItem[] };
type WalkableItem = WalkableNode & { readonly angle: number };

/**
 Walk `model` down `depth` levels, picking a uniformly random child at each,
 and report the angle of every item on the way: the path a generated stroke
 will aim for, and the leaf recognition is checked against.
 */
const randomPath = (
  model: WalkableNode,
  depth: number,
  random: () => number,
): { angles: number[]; leaf: WalkableItem | undefined } => {
  const angles: number[] = [];
  let node: WalkableNode = model;
  let leaf: WalkableItem | undefined;
  for (let level = 0; level < depth; level++) {
    const index = Math.floor(random() * node.items.length);
    leaf = node.items[index];
    if (leaf === undefined) {
      break;
    }

    angles.push(leaf.angle);
    node = leaf;
  }

  return { angles, leaf };
};

/**
 The fraction of `trials` generated strokes recognized as the exact leaf they
 were drawn for, on an evenly spaced menu of the given breadth and depth.

 @param options - Configuration options.
 @param options.breadth - The number of items per level.
 @param options.depth - The number of levels.
 @param options.trials - How many random paths to try.
 @param options.wobble - The wobble to generate strokes with. Defaults to the
 calibrated one.
 @param options.seed - Seeds both the path choices and the stroke noise, so a
 call with the same arguments always reports the same accuracy.
 */
export function measureAccuracy({
  breadth,
  depth,
  trials,
  wobble,
  seed = 0,
}: {
  breadth: number;
  depth: number;
  trials: number;
  wobble?: Wobble;
  seed?: number;
}): number {
  const model = buildMenu(breadth, depth);
  const random = createRandom(seed);
  let recognized = 0;
  for (let trial = 0; trial < trials; trial++) {
    const { angles, leaf } = randomPath(model, depth, random);
    const stroke = generateStroke({
      angles,
      seed: random() * 0x7f_ff_ff_ff,
      ...(wobble !== undefined && { wobble }),
    });
    if (recognizeMarkingMenuStroke(stroke, model) === leaf) {
      recognized++;
    }
  }

  return recognized / trials;
}
