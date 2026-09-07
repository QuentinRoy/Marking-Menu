import { createModel } from '../../model.js';
import { recognizeMarkingMenuStroke } from '../recognize-mm-stroke.js';
import { generateStroke, type Wobble } from './generate-stroke.js';
import { createRandom } from './random.js';

/*
 Builds a menu from a list of per-level item counts, draws a stroke for a
 random path through it, and reports how often the intended leaf comes
 back. This is the sweep the generated stroke corpus runs (see
 `../generated-stroke-corpus.test.ts`), kept in its own file so the test
 file stays focused on the calibration and the assertions.

 A list of counts maps to a distinct collection of angles: `createModel`
 spaces each level from its own item count. `[4, 8]` starts 90 degrees apart
 and enters a 45-degree submenu. The corpus builds menus through
 `createModel`, so it measures the layout currently used by the library.
 */

type CorpusItem = { angle?: number; label: string; items?: CorpusItem[] };

/**
 The items of a menu whose levels have the given item counts, from the top
 level down: `[4, 8]` builds a 4-item top level whose items each open an
 8-item submenu.
 */
const buildLevels = (
  breadths: readonly number[],
  statedAngles: ReadonlyArray<ReadonlyArray<number | undefined>>,
): CorpusItem[] => {
  const [breadth, ...rest] = breadths;
  if (breadth === undefined) {
    return [];
  }

  return Array.from({ length: breadth }, (_, index) => {
    const angle = statedAngles[0]?.[index];
    return {
      ...(angle !== undefined && { angle }),
      label: `item-${index}`,
      ...(rest.length > 0 && {
        items: buildLevels(rest, statedAngles.slice(1)),
      }),
    };
  });
};

/**
 A menu with one level per entry of `breadths`, each level holding that
 many items, laid out however `createModel` lays out a plain item list of
 that size.
 */
export const buildMenu = (
  breadths: readonly number[],
  statedAngles: ReadonlyArray<ReadonlyArray<number | undefined>> = [],
) => createModel({ items: buildLevels(breadths, statedAngles) });

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
 The fraction of `trials` generated strokes recognized as the exact leaf
 they were drawn for, on a menu with the given per-level item counts.

 @param options - Configuration options.
 @param options.breadths - One entry per level, from the top down: how many
 items that level holds.
 @param options.statedAngles - Optional per-level item angles. Each nested
 list follows that level's item order.
 @param options.trials - How many random paths to try.
 @param options.wobble - The wobble to generate strokes with. Defaults to the
 calibrated one.
 @param options.seed - Seeds both the path choices and the stroke noise, so a
 call with the same arguments always reports the same accuracy.
 */
export function measureAccuracy({
  breadths,
  statedAngles,
  trials,
  wobble,
  seed = 0,
}: {
  breadths: readonly number[];
  statedAngles?: ReadonlyArray<ReadonlyArray<number | undefined>>;
  trials: number;
  wobble?: Wobble;
  seed?: number;
}): number {
  const model = buildMenu(breadths, statedAngles);
  const random = createRandom(seed);
  let recognized = 0;
  for (let trial = 0; trial < trials; trial++) {
    const { angles, leaf } = randomPath(model, breadths.length, random);
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
