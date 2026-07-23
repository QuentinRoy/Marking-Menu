import { of } from 'rxjs';
import draw from './draw.js';

describe('draw', () => {
  it('augments drag notifications with the ongoing stroke', () => {
    const notifications = [];
    draw(of({ position: [1, 2] }, { position: [3, 4] }), {}).subscribe((n) => {
      notifications.push(n);
    });
    expect(notifications).toEqual([
      { stroke: [[1, 2]], position: [1, 2] },
      {
        stroke: [
          [1, 2],
          [3, 4],
        ],
        position: [3, 4],
      },
    ]);
  });

  it('adds the configured type to the notifications', () => {
    const notifications = [];
    draw(of({ position: [1, 2] }), { type: 'draw' }).subscribe((n) => {
      notifications.push(n);
    });
    expect(notifications).toEqual([
      { type: 'draw', stroke: [[1, 2]], position: [1, 2] },
    ]);
  });
});
