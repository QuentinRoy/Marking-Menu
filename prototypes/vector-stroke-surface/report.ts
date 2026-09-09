/*
 PROTOTYPE — issue #284. Throwaway.

 Renders `results.json` (written by `measure.ts`) as the markdown tables
 quoted in FINDINGS.md.
*/
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const here = import.meta.dirname;
const results = JSON.parse(
  await readFile(path.join(here, 'results.json'), 'utf8'),
) as any[];

const write = (line = '') => process.stdout.write(line + '\n');

const table = (headers: string[], rows: (string | number)[][]) => {
  write(`| ${headers.join(' | ')} |`);
  write(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) write(`| ${row.join(' | ')} |`);
  write();
};

const engines = results.map((r) => r.engine as string);

write('## Overflow and containment\n');
write(
  'Ink found strictly outside the parent box (and inside it, as a control).\n',
);
table(
  ['engine', 'surface', 'parent overflow', 'ink outside', 'ink inside'],
  results.flatMap((r) =>
    r.escapes.map((e: any) => [
      r.engine,
      e.surface,
      e.overflow,
      e.outside.ink,
      e.inside.ink,
    ]),
  ),
);

write('## Scroll area\n');
write('The parent sits in a 400x300 `overflow: auto` container.\n');
table(
  [
    'engine',
    'surface',
    'scrollWidth',
    'scrollHeight',
    'clientWidth (scrollbar)',
  ],
  results.flatMap((r) =>
    r.scrollArea.map((s: any) => [
      r.engine,
      s.surface,
      `${s.before.scroller.scrollWidth} → ${s.after.scroller.scrollWidth}`,
      `${s.before.scroller.scrollHeight} → ${s.after.scroller.scrollHeight}`,
      `${s.before.scroller.clientWidth} → ${s.after.scroller.clientWidth}`,
    ]),
  ),
);

write('## Fidelity\n');
write(
  'Same geometry, same stroke width, pixel-diffed at devicePixelRatio 2.\n',
);
const cases = results[0].fidelity.map((f: any) => f.caseName as string);
write(
  'Differing pixels are split by whether both surfaces painted there: ' +
    "`both` is the stroke's own anti-aliased edge, `one` is ground covered " +
    'by one surface and not the other.\n',
);
table(
  [
    'case',
    ...engines.map((e) => `${e}: differing (both/one), max channel diff`),
  ],
  cases.map((caseName: string) => [
    caseName,
    ...results.map((r) => {
      const f = r.fidelity.find((x: any) => x.caseName === caseName);
      return `${f.diff.differing} (${f.diff.bothPainted}/${f.diff.onePainted}), ${f.diff.maxDiff}`;
    }),
  ]),
);
table(
  ['case', ...engines.map((e) => `${e}: canvas ink / svg ink`)],
  cases.map((caseName: string) => [
    caseName,
    ...results.map((r) => {
      const f = r.fidelity.find((x: any) => x.caseName === caseName);
      return `${f.canvasInk} / ${f.svgInk}`;
    }),
  ]),
);

write('## Restacking siblings (no z-index)\n');
table(
  [
    'engine',
    'surface',
    'sibling order',
    'faded',
    'expected top',
    'sampled centre (rgb)',
  ],
  results.flatMap((r) =>
    r.restack.map((s: any) => [
      r.engine,
      s.surface,
      s.order,
      s.fade ? 'top two' : 'none',
      s.expected ?? 'blend',
      s.topColour,
    ]),
  ),
);

write('## Styling a path through `::part()`\n');
table(
  [
    'engine',
    'computed stroke',
    'computed stroke-width',
    'attributes it overrode',
  ],
  results.map((r) => [
    r.engine,
    r.cssStyling.stroke,
    r.cssStyling.strokeWidth,
    `${r.cssStyling.attributeStroke} / ${r.cssStyling.attributeStrokeWidth}`,
  ]),
);

write('## Cost of growing a canvas\n');
write(
  'A 1600x1200 parent at devicePixelRatio 2, grown by 200px eight times, ' +
    'replaying a 1200-point stroke after each growth.\n',
);
table(
  [
    'engine',
    'final backing store',
    'assign (mean/max ms)',
    'assign + replay (mean/max ms)',
  ],
  results.map((r) => [
    r.engine,
    `${r.growthCost.backingStore.widthPx}x${r.growthCost.backingStore.heightPx} (${r.growthCost.backingStore.megabytes} MB)`,
    `${r.growthCost.assign.mean} / ${r.growthCost.assign.max}`,
    `${r.growthCost.assignAndReplay.mean} / ${r.growthCost.assignAndReplay.max}`,
  ]),
);

write('## Per-frame cost, one point per animation frame\n');
const variants = results[0].frameCost.map((f: any) => f.variant as string);
table(
  ['variant', ...engines.map((e) => `${e} frame gap p50/p95/max, >17ms`)],
  variants.map((variant: string) => [
    variant,
    ...results.map((r) => {
      const f = r.frameCost.find((x: any) => x.variant === variant);
      return `${f.frameGap.p50}/${f.frameGap.p95}/${f.frameGap.max}, ${f.longFrames.over17ms}`;
    }),
  ]),
);

write('## Synchronous cost of a whole stroke (ms)\n');
write(
  'Total time to push every point, timed once so the result clears the ' +
    "engines' timer coarsening. `forced` calls `getBBox()` after each " +
    'point, which is what makes an engine reparse the `d` it was handed.\n',
);
const counts = results[0].syncCost[0].runs.map((x: any) => x.count as number);
for (const forced of [false, true]) {
  write(`### ${forced ? 'reparse forced' : 'attribute set only'}\n`);
  table(
    ['variant', ...engines.flatMap((e) => counts.map((c) => `${e} @${c}`))],
    variants.map((variant: string) => [
      variant,
      ...results.flatMap((r) => {
        const entry = r.syncCost.find(
          (x: any) => x.variant === variant && x.forceGeometry === forced,
        );
        return entry.runs.map((run: any) => run.totalMs);
      }),
    ]),
  );
}

write('## Where the svg spellings diverge (ms)\n');
write(
  'Longer strokes than a gesture can plausibly produce, to separate the ' +
    "split's residual quadratic — it rewrites the frozen path every 100 " +
    'points — from the chunked variant, which never rewrites anything. ' +
    '`el` is how many `<path>` elements the variant left in the DOM.\n',
);
{
  const longCounts: number[] = [
    ...new Set(results[0].asymptotics.map((a: any) => a.count as number)),
  ];
  const longVariants: string[] = [
    ...new Set(results[0].asymptotics.map((a: any) => a.variant as string)),
  ];
  for (const forced of [false, true]) {
    write(`### ${forced ? 'reparse forced' : 'attribute set only'}\n`);
    table(
      [
        'variant',
        ...engines.flatMap((e) => longCounts.map((c) => `${e} @${c}`)),
      ],
      longVariants.map((variant) => [
        variant,
        ...results.flatMap((r) =>
          longCounts.map((count) => {
            const run = r.asymptotics.find(
              (a: any) =>
                a.variant === variant &&
                a.count === count &&
                a.forceGeometry === forced,
            );
            return `${run.totalMs} (${run.elements} el)`;
          }),
        ),
      ]),
    );
  }
}
