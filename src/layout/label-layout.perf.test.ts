import { at } from '../utils.js';
import { default8ItemMenu } from './label-layout-corpus.js';
import { solveLabelLayout } from './label-layout.js';

// Solver-only timing evidence for the issue's ~50ms P95 production gate, at
// today's real maximum of 8 items. A miss here is the documented trigger
// for moving the solver to a Web Worker, not something to build ahead of.
it('meets the ~50ms P95 solver-only budget at the intended max item count', () => {
  const runs = 200;
  const timings = Array.from({ length: runs }, () => {
    const start = performance.now();
    solveLabelLayout(default8ItemMenu);
    return performance.now() - start;
  }).toSorted((a, b) => a - b);
  const p95 = at(timings, Math.floor(runs * 0.95));

  console.log(
    `label layout solver: median ${at(timings, Math.floor(runs / 2)).toFixed(2)}ms, ` +
      `p95 ${p95.toFixed(2)}ms, worst ${at(timings, runs - 1).toFixed(2)}ms over ${runs} runs`,
  );
  expect(p95).toBeLessThanOrEqual(50);
});
