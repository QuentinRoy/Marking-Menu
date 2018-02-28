import {
  deltaAngle,
  mod,
  dist,
  angle,
  findMaxEntry,
  strToHTML,
  toPolar
} from './utils';

describe('mod', () => {
  it(' returns a positive modulo', () => {
    expect(mod(3, 10)).toBe(3);
    expect(mod(-3, 10)).toBe(7);
    expect(mod(13, 10)).toBe(3);
    expect(mod(-13, 10)).toBe(7);
  });
});

describe('deltaAngle', () => {
  it(' properly returns the delta between two angles', () => {
    expect(deltaAngle(40, 50)).toBe(10);

    expect(deltaAngle(40, 50 + 360)).toBe(10);
    expect(deltaAngle(40, 50 - 360)).toBe(10);
    expect(deltaAngle(40 + 360, 50)).toBe(10);
    expect(deltaAngle(40 - 360, 50)).toBe(10);

    expect(deltaAngle(50, 40)).toBe(-10);

    expect(deltaAngle(50, 40 + 360)).toBe(-10);
    expect(deltaAngle(50, 40 - 360)).toBe(-10);
    expect(deltaAngle(50 + 360, 40)).toBe(-10);
    expect(deltaAngle(50 - 360, 40)).toBe(-10);
  });
});

describe('dist', () => {
  it(' returns the euclidean distance between two vectors', () => {
    expect(dist([0, 0], [0, 0])).toBe(0);
    expect(dist([42, 11], [42, 11])).toBe(0);

    expect(dist([0, 0], [0, 1])).toBe(1);
    expect(dist([1, 0], [0, 0])).toBe(1);

    expect(dist([5, 10], [20, 4])).toBe(
      Math.sqrt((5 - 20) ** 2 + (10 - 4) ** 2)
    );
    expect(dist([20, 4], [5, 10])).toBe(
      Math.sqrt((5 - 20) ** 2 + (10 - 4) ** 2)
    );

    expect(dist([42, 11, 5, 8, 0], [42, 11, 5, 8, 0])).toBe(0);
    expect(dist([1, 1, 0, 0, 1], [0, 0, 1, 1, 0])).toBe(Math.sqrt(5));
    expect(dist([1, 2, 3, 7, 8], [4, 5, 6, 9, 10])).toBe(
      Math.sqrt(
        (1 - 4) ** 2 +
          (2 - 5) ** 2 +
          (3 - 6) ** 2 +
          (7 - 9) ** 2 +
          (8 - 10) ** 2
      )
    );
  });
});

describe('angle', () => {
  it(' calculate an angle from three points', () => {
    expect(angle([5, 1], [1, 1], [1, 20])).toBe(90);
    expect(angle([5, 1], [1, 1], [1, -20])).toBe(90);
    expect(angle([5, 1], [1, 1], [110, 1])).toBe(0);
    expect(angle([5, 5], [1, 5], [-10, 5])).toBe(180);
    expect(angle([5, 5], [1, 1], [5, 1])).toBe(45);
    expect(angle([5, 5], [1, 1], [-10, -10])).toBe(180);
  });
});

describe('findMaxEntry', () => {
  it(' return an entry with the item that raised the highest number', () => {
    expect(
      findMaxEntry(
        [{ l: 2 }, { l: 0 }, { l: 10 }, { l: 5 }],
        (a, b) => b.l - a.l
      )
    ).toEqual([2, { l: 10 }]);
    expect(
      findMaxEntry(
        [{ l: 2 }, { l: 0 }, { l: 10 }, { l: 5 }],
        (a, b) => a.l - b.l
      )
    ).toEqual([1, { l: 0 }]);
  });
});

describe('toPolar', () => {
  it(' calculates the coordinates of a point in a polar system', () => {
    expect(toPolar([10, 0], [0, 0])).toEqual({ azymuth: 0, radius: 10 });
    expect(toPolar([10, 0])).toEqual({ azymuth: 0, radius: 10 });
    expect(toPolar([10, 5], [5, 5])).toEqual({ azymuth: 0, radius: 5 });
    expect(toPolar([-10, -20], [-10, -20])).toEqual({ azymuth: 0, radius: 0 });
    expect(toPolar([10, 15], [0, 5])).toEqual({
      azymuth: 45,
      radius: Math.sqrt(10 * 10 + 10 * 10)
    });
    expect(toPolar([-10, 0])).toEqual({ azymuth: 180, radius: 10 });
    expect(toPolar([0, -20])).toEqual({ azymuth: -90, radius: 20 });
  });
});

describe('strToHTML', () => {
  it(' parses a string as a DOM Element', () => {
    const collection = strToHTML(
      `
        <ul style="position: absolute;">
          <li>That thing</li>
          <li>That other thing</li>
        </ul>

        <svg xmlns="http://www.w3.org/2000/svg"
        width="150" height="100" viewBox="0 0 3 2">
          <rect width="1" height="2" x="0" fill="#008d46" />
          <rect width="1" height="2" x="1" fill="#ffffff" />
          <rect width="1" height="2" x="2" fill="#d2232c" />
        </svg>

        <div class="that-thing">I exist too</div>
      `,
      document
    );
    expect(collection[0].tagName).toBe('UL');
    expect(collection[1].tagName).toBe('svg');
    expect(collection[2].tagName).toBe('DIV');
    expect(
      // This needs to be converted to an array as snapshoting an HTMLCollection
      // makes Jest go crazy.
      Array.from(collection)
    ).toMatchSnapshot();
  });
});
