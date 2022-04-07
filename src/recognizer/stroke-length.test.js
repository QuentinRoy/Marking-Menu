import strokeLength from './stroke-length';

describe('strokeLength', () => {
  it('calculate the length of a path', () => {
    expect(strokeLength([])).toBe(0);
    expect(strokeLength([[54, 234]])).toBe(0);
    expect(
      strokeLength([
        [1, 0],
        [1, 1.5],
        [1, 2],
        [3.2, 2],
      ])
    ).toBe(4.2);
    expect(
      strokeLength([
        [1, 0],
        [1, 1],
        [1, 0],
      ])
    ).toBe(2);
    expect(
      strokeLength([
        [0, 0],
        [1, 1],
        [1, 2],
      ])
    ).toBe(1 + Math.sqrt(2));
    expect(
      strokeLength([
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
      ])
    ).toBe(2);
  });
});
