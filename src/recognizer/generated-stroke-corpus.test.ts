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

 Measured at freeze time, 1000 trials per configuration (the assertions below
 run 500, which is enough to hold a floor without slowing the suite down):

   breadth  depth  accuracy
   4        1      100.0%
   4        3       98.9%
   8        1       88.8%
   8        3       78.3%

 The gap between the two breadths is exactly the effect a fixed amount of
 hand wobble should have: the recognizer's corner threshold is half the
 menu's smallest angular gap, so the same wobble eats a much bigger share of
 an 8-item menu's 45-degree gap than a 4-item menu's 90-degree one. Depth 3
 compounds three independent per-level draws, which is why its accuracy sits
 below depth 1's for both breadths.

 The assertions below hold the two even menus to a floor comfortably under
 those measurements, so the suite tolerates ordinary run-to-run noise without
 tolerating a real regression. Item counts of 5, 6 and 7 use the library's
 current, crowded layout rather than an evenly spaced one (see issue #43).
 They are swept and reported here for later work to compare against, but
 are not held to a floor of their own.

 "Angle configurations" here means breadth and depth, since stating an
 item's own angle doesn't exist yet: that lands in issue #43, and the menus
 it produces will sweep through the same `measureAccuracy` this file uses.
 */

describe('generated stroke corpus', () => {
  describe('menus the library already lays out evenly', () => {
    it.each([
      { breadth: 4, depth: 1, floor: 0.97 },
      { breadth: 4, depth: 3, floor: 0.9 },
      { breadth: 8, depth: 1, floor: 0.75 },
      { breadth: 8, depth: 3, floor: 0.55 },
    ])(
      'recognizes $breadth items, $depth level(s) deep, at least $floor of the time',
      ({ breadth, depth, floor }) => {
        const accuracy = measureAccuracy({
          breadth,
          depth,
          trials: 500,
          seed: breadth * 1000 + depth,
        });

        expect(accuracy).toBeGreaterThanOrEqual(floor);
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
          breadth,
          depth: 1,
          trials: 500,
          seed: breadth * 1000,
        });

        expect(accuracy).toBeGreaterThan(0);
        expect(accuracy).toBeLessThanOrEqual(1);
      },
    );
  });
});
