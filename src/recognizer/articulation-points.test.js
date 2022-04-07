import getStrokeArticulationPoints from './articulation-points';

describe(getStrokeArticulationPoints, () => {
  it('works for simple strokes', () => {
    expect(
      getStrokeArticulationPoints(
        [
          [0, 0],
          [1, 0],
          [3, 0],
          [5, 0],
          [5, 1],
          [5, 2],
          [5, 3],
        ],
        8 / 2, // Expected length is usually strokeLength / menuBreadth.
        20
      )
    ).toEqual([
      [0, 0],
      [5, 0],
      [5, 3],
    ]);
    expect(
      getStrokeArticulationPoints(
        [
          [0, 3],
          [1, 3],
          [3, 3],
          [5, 3],
          [5, 0],
          [5, -2],
          [5, -3],
        ],
        11 / 2,
        30
      )
    ).toEqual([
      [0, 3],
      [5, 3],
      [5, -3],
    ]);
    expect(
      getStrokeArticulationPoints(
        [
          [0, 3],
          [1, 3],
          [3, 3],
          [5, 3],
          [6, 4],
          [8, 6],
          [10, 8],
        ],
        (5 + Math.sqrt(5 ** 2 + 5 ** 2)) / 2,
        30
      )
    ).toEqual([
      [0, 3],
      [5, 3],
      [10, 8],
    ]);
    expect(
      getStrokeArticulationPoints(
        [
          [3, 6],
          [4, 6],
          [5, 6],
          [6, 6],
          [7, 6],
          [8, 6], // articulation
          [7, 5],
          [6, 4],
          [5, 3],
          [4, 2],
          [3, 1], // articulation
          [3, 2],
          [3, 3],
          [3, 4],
          [3, 5],
          [3, 8],
        ],
        (5 + Math.sqrt(5 ** 2 + 5 ** 2) + 4) / 3,
        30
      )
    ).toEqual([
      [3, 6],
      [8, 6],
      [3, 1],
      [3, 8],
    ]);
  });
});
