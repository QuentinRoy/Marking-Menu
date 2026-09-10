import * as corpusFixtures from './label-layout-corpus.js';
import { oversized } from './label-layout-corpus.js';
import { validateLabelLayout } from './label-layout-validator.js';
import { solveLabelLayout, type LayoutInput } from './label-layout.js';

describe('solveLabelLayout', () => {
  describe.each(Object.entries(corpusFixtures.corpus))('%s', (_name, input) => {
    it('produces a layout that satisfies every hard constraint', () => {
      const result = solveLabelLayout(input);
      const validation = validateLabelLayout(input, result);
      expect(validation.failures).toEqual([]);
      expect(validation.valid).toBe(true);
    });

    it('is deterministic across repeated solves of the same input', () => {
      const first = solveLabelLayout(input);
      const second = solveLabelLayout(input);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });
  });

  it('reports an oversized result with no plates when nothing fits', () => {
    const result = solveLabelLayout(oversized);
    expect(result.status).toBe('oversized');
    expect(result.plates).toEqual([]);
    expect(validateLabelLayout(oversized, result).valid).toBe(true);
  });

  it('finds the provably optimal layout for a small, unconstrained case', () => {
    // With two well-separated items and generous clearances, no candidate
    // can beat the shared-radius layout on any objective: it is already the
    // smallest contact radius that fits, with zero tangential shift.
    const input: LayoutInput = {
      plates: [
        { angle: 0, width: 80, height: 20 },
        { angle: 180, width: 80, height: 20 },
      ],
      ringRadius: 80,
      clearances: {
        plateHorizontal: 14,
        plateVertical: 7,
        plateToRing: 12,
        plateToConnector: 3,
      },
    };
    const result = solveLabelLayout(input);
    expect(result.status).toBe('optimal');
    expect(result.plates).toHaveLength(2);
    for (const plate of result.plates) {
      expect(plate.y).toBeCloseTo(0, 5);
    }

    const [first, second] = result.plates;
    expect(Math.abs(first?.x ?? NaN)).toBeCloseTo(
      Math.abs(second?.x ?? NaN),
      5,
    );
  });
});
