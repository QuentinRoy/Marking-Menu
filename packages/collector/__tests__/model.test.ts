import { makeTimeline } from '../model.ts';

test('a session number always yields the same timeline', () => {
  expect(makeTimeline(2)).toEqual(makeTimeline(2));
  expect(makeTimeline(2)).not.toEqual(makeTimeline(3));
});

test('task numbers count every task from 1, warm-ups included', () => {
  const timeline = makeTimeline(1);
  expect(timeline.map((task) => task.taskNumber)).toEqual(
    timeline.map((_, index) => index + 1),
  );
  expect(timeline.slice(0, 3).every((task) => task.warmup)).toBe(true);
  expect(new Set(timeline.map((task) => task.trialId)).size).toBe(
    timeline.length,
  );
});

test('four sessions cover each direction and turn class', () => {
  const trials = [1, 2, 3, 4]
    .flatMap((session) => makeTimeline(session))
    .filter((task) => !task.warmup);

  for (const breadth of [4, 8, 12, 16]) {
    for (const depth of [1, 2, 3]) {
      const cell = trials.filter(
        (task) => task.breadth === breadth && task.depth === depth,
      );
      expect(cell).toHaveLength(depth === 1 ? breadth * 10 : 80);

      for (let level = 0; level < depth; level++) {
        const counts = Array.from(
          { length: breadth },
          (_, direction) =>
            cell.filter((task) => task.targetIndices[level] === direction)
              .length,
        );
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
          breadth === 12 ? 4 : 0,
        );
      }

      for (let level = 1; level < depth; level++) {
        const classes =
          breadth === 4 ? [0, 1, -1, 2] : [0, 1, -1, breadth / 2, 'other'];
        const counts = classes.map(
          (turnClass) =>
            cell.filter((task) => {
              const offset =
                ((task.targetIndices[level] ?? -1) -
                  (task.targetIndices[level - 1] ?? -1) +
                  breadth) %
                breadth;
              return turnClass === 'other'
                ? offset === 2 || offset === breadth - 2
                : offset === (Number(turnClass) + breadth) % breadth;
            }).length,
        );
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
          breadth === 12 ? 2 : 0,
        );
        expect(
          [2, breadth - 2].every((offset) =>
            cell.some(
              (task) =>
                ((task.targetIndices[level] ?? -1) -
                  (task.targetIndices[level - 1] ?? -1) +
                  breadth) %
                  breadth ===
                offset,
            ),
          ),
        ).toBe(true);
      }
    }
  }
});
