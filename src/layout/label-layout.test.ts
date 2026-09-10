import * as corpusFixtures from './__fixtures__/label-layout-corpus.js';
import { oversized } from './__fixtures__/label-layout-corpus.js';
import { validateLabelLayout } from './__fixtures__/label-layout-validator.js';
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
    expect(result.oversized).toBe(true);
    expect(result.plates).toEqual([]);
    expect(validateLabelLayout(oversized, result).valid).toBe(true);
  });

  it('leaves the shared-radius layout untouched when no greedy move improves it', () => {
    // Two items on opposite sides with generous clearances: no move can
    // beat the shared-radius layout on any measure, so greedy compaction
    // must be a no-op.
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
    expect(result.oversized).toBe(false);
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

  it('compacts a crowded menu closer than a uniform shared radius would sit', () => {
    // One much wider plate among evenly spaced narrow ones: a shared
    // radius must clear the wide plate everywhere, pushing every other
    // plate out with it. Greedy compaction should pull the narrow plates
    // back in, so the total connector-contact radius drops below what
    // every plate sitting at the widest one's radius would total.
    const input = corpusFixtures.oneExtremeWidth;
    const result = solveLabelLayout(input);
    expect(result.oversized).toBe(false);
    const contacts = result.plates.map((plate) =>
      Math.hypot(...plate.connectorContact),
    );
    const totalContact = contacts.reduce((sum, value) => sum + value, 0);
    expect(totalContact).toBeLessThan(
      Math.max(...contacts) * input.plates.length,
    );
  });

  it('keeps the canvas 20-degree pairs close to the ring', () => {
    const result = solveLabelLayout(corpusFixtures.twentyDegreePairs);
    expect(result.oversized).toBe(false);
    const contacts = result.plates.map((plate) =>
      Math.hypot(...plate.connectorContact),
    );
    expect(Math.max(...contacts) - Math.min(...contacts)).toBeLessThan(4);
  });
});
