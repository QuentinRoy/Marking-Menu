import { validateLabelLayout } from './label-layout-validator.js';
import type { LayoutInput, LayoutResult } from './label-layout.js';

const clearances = {
  plateHorizontal: 14,
  plateVertical: 7,
  plateToRing: 12,
  plateToConnector: 3,
};

describe('validateLabelLayout', () => {
  it('passes an oversized result through unchecked', () => {
    const input: LayoutInput = { plates: [], ringRadius: 80, clearances };
    expect(
      validateLabelLayout(input, { oversized: true, plates: [] }).valid,
    ).toBe(true);
  });

  it('flags a non-finite coordinate and a connector that misses its plate', () => {
    const input: LayoutInput = {
      plates: [{ angle: 0, width: 100, height: 20 }],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [{ x: NaN, y: 0, connectorContact: [80, 0] }],
    };
    const { failures } = validateLabelLayout(input, result);
    expect(failures).toContain('plate 0 has a non-finite coordinate');
    expect(failures).toContain('connector 0 misses its plate');
  });

  it('flags a connector that leaves its fixed direction', () => {
    const input: LayoutInput = {
      plates: [{ angle: 90, width: 100, height: 20 }],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      // Angle 90 points straight up (x = 0); this contact sits off that ray.
      plates: [{ x: 0, y: 150, connectorContact: [50, 80] }],
    };
    expect(validateLabelLayout(input, result).failures).toContain(
      'connector 0 left its fixed direction',
    );
  });

  it('flags a connector pointing into the ring and a plate inside the ring clearance', () => {
    const input: LayoutInput = {
      plates: [{ angle: 180, width: 100, height: 20 }],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [{ x: -10, y: 0, connectorContact: [-10, 0] }],
    };
    const { failures } = validateLabelLayout(input, result);
    expect(failures).toContain('connector 0 points into the ring');
    expect(failures).toContain('plate 0 enters the ring clearance');
  });

  it('flags a mismatched plate count', () => {
    const input: LayoutInput = {
      plates: [
        { angle: 0, width: 100, height: 20 },
        { angle: 90, width: 100, height: 20 },
      ],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [{ x: 150, y: 0, connectorContact: [80, 0] }],
    };
    expect(validateLabelLayout(input, result).failures).toContain(
      'plate count differs from input',
    );
  });

  it('flags overlapping plates', () => {
    const input: LayoutInput = {
      plates: [
        { angle: 0, width: 100, height: 20 },
        { angle: 90, width: 100, height: 20 },
      ],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [
        { x: 150, y: 0, connectorContact: [100, 0] },
        // 10px away on both axes: well inside the required gaps.
        { x: 150, y: 10, connectorContact: [0, 80] },
      ],
    };
    expect(validateLabelLayout(input, result).failures).toContain(
      'plates 0 and 1 overlap',
    );
  });

  it('flags a connector interfering with a neighboring plate', () => {
    const input: LayoutInput = {
      plates: [
        { angle: 0, width: 100, height: 20 },
        { angle: 90, width: 100, height: 20 },
      ],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [
        // Contact (300, 0) sits on this plate's own boundary, but the
        // segment from the ring to it runs straight through plate 1's box.
        { x: 350, y: 0, connectorContact: [300, 0] },
        { x: 150, y: 0, connectorContact: [0, 80] },
      ],
    };
    expect(validateLabelLayout(input, result).failures).toContain(
      'connector 0 interferes with plate 1',
    );
  });

  it('flags plate centers that change the cyclic item order', () => {
    const input: LayoutInput = {
      plates: [
        { angle: 0, width: 40, height: 20 },
        { angle: 90, width: 40, height: 20 },
        { angle: 180, width: 40, height: 20 },
      ],
      ringRadius: 80,
      clearances,
    };
    const result: LayoutResult = {
      oversized: false,
      plates: [
        { x: 150, y: 0, connectorContact: [80, 0] },
        // Items 1 and 2 sit at each other's expected position.
        { x: -150, y: 0, connectorContact: [0, 80] },
        { x: 0, y: 150, connectorContact: [-80, 0] },
      ],
    };
    expect(validateLabelLayout(input, result).failures).toContain(
      'plate centers change the cyclic item order',
    );
  });
});
