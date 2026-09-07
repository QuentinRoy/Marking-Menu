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

 Menus with 3, 5, 6, and 7 items are also evenly spaced. Their one-level
 accuracy stays at or above 98%, so the corpus holds that floor alongside the
 existing 4- and 8-item calibration checks.
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

  describe('menus newly laid out evenly', () => {
    it.each([3, 5, 6, 7])(
      'recognizes a %i-item, 1 level menu at or above 98%',
      (breadth) => {
        const accuracy = measureAccuracy({
          breadths: [breadth],
          trials: 500,
          seed: breadth * 1000,
        });

        expect(accuracy).toBeGreaterThanOrEqual(0.98);
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

  it('recognizes a menu with stated and free angles at or above 80%', () => {
    const accuracy = measureAccuracy({
      breadths: [4, 5],
      statedAngles: [
        [0, undefined, 180, undefined],
        [0, undefined, 90, undefined, 270],
      ],
      trials: 500,
      seed: 244,
    });

    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
