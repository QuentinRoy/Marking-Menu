import {
  findMiddlePointForMinAngle,
  findNextPointFurtherThan,
} from './find-points';

describe('findMiddlePointForMaxAngle', () => {
  it('finds the point maximizing the angle', () => {
    expect(
      findMiddlePointForMinAngle(
        [0, 0],
        [5, 5],
        [
          [5, 2],
          [5, 0],
          [0, 3],
          [3, 0],
        ]
      )
    ).toEqual({ index: 1, angle: 90 });

    expect(
      findMiddlePointForMinAngle(
        [-5, 0],
        [1, 0],
        [
          [0, 0],
          [-1, 0],
          [-4, 1],
          [-3, 0],
          [4, 0],
          [0, 0],
        ]
      )
    ).toEqual({ index: 4, angle: 0 });

    expect(
      findMiddlePointForMinAngle(
        [0, 0],
        [5, 5],
        [
          [5, 2],
          [0, 3],
          [0, 5],
          [3, 0],
          [0, 10],
        ]
      )
    ).toEqual({ index: 4, angle: 45 });

    expect(
      findMiddlePointForMinAngle(
        [-5, 0],
        [1, 0],
        [
          [6, 0],
          [-1, 0],
          [-4, 1],
          [-3, 0],
          [4, 0],
          [5, 0],
        ],
        { startIndex: 1 }
      )
    ).toEqual({ index: 4, angle: 0 });

    expect(
      findMiddlePointForMinAngle(
        [0, 0],
        [5, 5],
        [
          [5, 2],
          [0, 3],
          [0, 5],
          [3, 0],
          [0, 10],
        ],
        { endIndex: 3 }
      )
    ).toEqual({ index: 2, angle: 90 });

    expect(
      findMiddlePointForMinAngle(
        [0, 0],
        [5, 5],
        [
          [0, 5],
          [5, 2],
          [0, 3],
          [0, 5],
          [3, 0],
          [0, 10],
        ],
        { startIndex: 1, endIndex: 3 }
      )
    ).toEqual({ index: 3, angle: 90 });
  });
});

describe('findNextPointFurtherThan', () => {
  it('finds the first point at least at a given distance from the reference point', () => {
    expect(
      findNextPointFurtherThan(
        [
          [0, 1],
          [1, 1],
          [1, 2],
          [2, 2],
          [1, 2],
          [0, 3],
          [0, 4],
          [0, 5],
          [0, 6],
        ],
        5,
        { startIndex: 0, refPoint: [0, 0], direction: 1 }
      )
    ).toBe(7);

    expect(
      findNextPointFurtherThan(
        [
          [7, 7],
          [1, 1],
          [1, 2],
          [2, 2],
          [1, 2],
          [0, 3],
          [0, 4],
          [0, 5],
          [0, 6],
        ],
        5,
        { startIndex: 0, refPoint: [0, 0], direction: 1 }
      )
    ).toBe(0);

    expect(
      findNextPointFurtherThan(
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
          [1, 6],
          [2, 7],
        ],
        10,
        { startIndex: 0, refPoint: [0, 0], direction: 1 }
      )
    ).toBe(-1);

    expect(
      findNextPointFurtherThan([], 0, 0, { refPoint: [0, 0], direction: 1 })
    ).toBe(-1);

    expect(
      findNextPointFurtherThan(
        [
          [7, 7],
          [1, 1],
          [1, 2],
          [2, 2],
          [1, 2],
          [0, 3],
          [0, 4],
          [0, 5],
          [0, 6],
        ],
        5,
        { startIndex: 1, refPoint: [0, 0], direction: 1 }
      )
    ).toBe(7);

    expect(
      findNextPointFurtherThan(
        [
          [7, 7],
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
          [1, 6],
          [2, 6],
        ],
        5,
        { startIndex: 1, direction: 1 }
      )
    ).toBe(5);

    expect(
      findNextPointFurtherThan(
        [
          [7, 7],
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
          [1, 6],
          [2, 6],
        ],
        5,
        { startIndex: 1, refPoint: [0, 0] }
      )
    ).toBe(5);

    expect(
      findNextPointFurtherThan(
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
          [1, 6],
          [2, 7],
        ],
        5,
        { direction: 1, refPoint: [2, 2] }
      )
    ).toBe(5);

    expect(
      findNextPointFurtherThan(
        [
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
          [1, 6],
          [2, 7],
        ],
        5
      )
    ).toBe(4);

    expect(findNextPointFurtherThan([], 0)).toBe(-1);

    expect(
      findNextPointFurtherThan(
        [
          [1, 6],
          [2, 7],
          [1, 1],
          [1, 2],
          [2, 2],
          [0, 4],
        ],
        5,
        { startIndex: 4, refPoint: [0, 0], direction: -1 }
      )
    ).toBe(1);

    expect(
      findNextPointFurtherThan(
        [
          [-4, -4],
          [1, 1],
          [2, 2],
          [5, 5],
          [2, 2],
          [1, 1],
          [0, 0],
        ],
        2,
        { direction: -1 }
      )
    ).toBe(4);
  });
});
