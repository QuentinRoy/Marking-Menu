import { measureAccuracy } from './__fixtures__/stroke-corpus.js';

/*
 Calibration

 A generated stroke with no wobble is a straight line that lands dead center
 of its target, so it recognizes perfectly no matter how crowded the menu is.
 That tests nothing: the whole point of this corpus is to tell a workable
 layout from a crowded one, and only noise shaped like a real hand lets it do
 that.

 There is no fresh human data to calibrate against, and the 13 recorded
 strokes in `__fixtures__/strokes` are deliberately not being added to (see
 issue #43): 13 strokes from one person, all on multiples of 45 degrees,
 would be weak evidence for tuning a noise model either way. What they are
 good for is a floor: they must keep passing, unchanged, in
 `recognize-mm-stroke.test.ts`. This corpus's own wobble
 (`__fixtures__/generate-stroke.ts`'s `CALIBRATED_WOBBLE`) was tuned by ear
 against that same recognizer, on the two menus it lays out evenly today:
 4 items (90 degrees apart) and 8 (45 degrees apart). The target was "close
 to how a skilled user would score, not a perfect score": high on the wide,
 4-item gaps, and visibly, but not catastrophically, worse on the narrow,
 8-item ones.

 The generator and the menus it is measured against are both fully
 deterministic: the same breadths, trial count and seed always produce the
 same points and walk the same paths, on any machine. There is no real
 run-to-run noise to tolerate here, so the assertions below check a tight
 band around the measured accuracy rather than a bare floor. A floor alone
 only catches too much wobble; it would wave through a wobble quietly
 turned down toward zero, which would show up here as suspiciously perfect
 scores rather than failures. Measured (and asserted) at 500 trials per
 configuration:

   breadths   accuracy
   [4]        100.0%
   [4, 4, 4]   99.2%
   [8]         90.4%
   [8, 8, 8]   78.8%

 The gap between the two breadths is exactly the effect a fixed amount of
 hand wobble should have: the recognizer's corner threshold is half the
 menu's smallest angular gap, so the same wobble eats a much bigger share of
 an 8-item menu's 45-degree gap than a 4-item menu's 90-degree one. Three
 levels compounds three independent per-level draws, which is why its
 accuracy sits below one level's for both breadths.

 Item counts of 5, 6 and 7 use the library's current, crowded layout rather
 than an evenly spaced one (see issue #43), and a menu whose levels hold
 different counts is an angle configuration of its own: `createModel` spaces
 each level by that level's own count, so `[4, 8]` walks a 90-degree-spaced
 top level into a 45-degree-spaced submenu, a spacing no single uniform
 breadth produces. Both are swept and reported below for later work to
 compare against, but neither is held to a floor of their own: stating an
 item's own angle doesn't exist yet either, and that is what issue #43 adds.
 */

describe('generated stroke corpus', () => {
  describe('menus the library already lays out evenly', () => {
    it.each([
      { breadths: [4], accuracy: 1, seed: 4001 },
      { breadths: [4, 4, 4], accuracy: 0.992, seed: 4003 },
      { breadths: [8], accuracy: 0.904, seed: 8001 },
      { breadths: [8, 8, 8], accuracy: 0.788, seed: 8003 },
    ])(
      'recognizes $breadths close to the calibrated $accuracy',
      ({ breadths, accuracy, seed }) => {
        const measured = measureAccuracy({ breadths, trials: 500, seed });

        expect(measured).toBeGreaterThanOrEqual(accuracy - 0.02);
        expect(measured).toBeLessThanOrEqual(accuracy + 0.02);
      },
    );
  });

  describe('sweeping item counts the library does not yet lay out evenly', () => {
    // These counts share their layout's 45-degree step with the 8-item menu
    // above (see `getAngleRange` in `../model.ts`), so a sane implementation
    // scores in the same ballpark; nothing here pins that down as a
    // requirement, only reports it.
    it.each([3, 5, 6, 7])(
      'reports an accuracy for a %i-item, 1 level menu',
      (breadth) => {
        const accuracy = measureAccuracy({
          breadths: [breadth],
          trials: 500,
          seed: breadth * 1000,
        });

        expect(accuracy).toBeGreaterThan(0);
        expect(accuracy).toBeLessThanOrEqual(1);
      },
    );
  });

  describe('sweeping angle configurations across levels', () => {
    it.each([
      { breadths: [4, 8] },
      { breadths: [8, 4] },
      { breadths: [8, 5] },
      { breadths: [5, 6, 7] },
    ])('reports an accuracy for a $breadths menu', ({ breadths }) => {
      const accuracy = measureAccuracy({
        breadths,
        trials: 500,
        seed: Number(breadths.join('')),
      });

      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    });
  });
});
