# Vector stroke surface — prototype

Throwaway. Built to answer [#284](https://github.com/QuentinRoy/Marking-Menu/issues/284):
can the library draw its strokes with an `<svg>` path instead of a `<canvas>`,
and does a path painted outside the element's box behave the way
[#278](https://github.com/QuentinRoy/Marking-Menu/issues/278)'s map needs?

Nothing here imports the library. The surfaces are hand-copied: the canvas one
mirrors `src/layout/stroke.ts`, the svg one is the candidate. Points are
synthetic — a spiral, which is longer and more angular than a real gesture.

The answers are in [FINDINGS.md](./FINDINGS.md); the raw numbers behind them in
`results.json`.

## Run it

Open `index.html` and click the buttons: every probe is on the page, and the
result of each prints as JSON. Nothing to build, nothing to serve.

To reproduce the numbers across all three engines:

```sh
yarn prototype:vector-stroke          # writes results.json (~8 min)
yarn prototype:vector-stroke:report   # renders it as the tables in FINDINGS.md
```

`measure.ts` drives the same page through Playwright's Chromium, Firefox and
WebKit, and reads the pixels a human eye would otherwise judge. Two knobs:
`POINTS` changes the stroke length the timing probes use (default 1200), and
`SKIP_PERF=1` drops the timing sweep, which is the slow half — the rest of the
probes finish in seconds.

## What each probe answers

| Probe                               | Bullet in #284                                                              |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `paintEscape` (`overflow: visible`) | Overflow: does the path paint outside the box?                              |
| `paintEscape` (`overflow: hidden`)  | Containment: does the parent still clip it?                                 |
| `scrollArea`                        | Does painting outside extend the nearest scroll container?                  |
| `fidelity`, `singlePointDot`        | Round caps and joins, one-point strokes, the start marker                   |
| `restack`                           | Do several `<svg>` siblings restack like the canvases do?                   |
| `frameCost`                         | Cost per frame, one point per animation frame                               |
| `scaling` / `syncCost`              | The same work timed above the engines' timer floor, at three stroke lengths |
| `growthCost`                        | What #279's growth rule costs: a new, zeroed backing store                  |

## Caveats

- Headless engines on macOS, `deviceScaleFactor: 2`. Rasterization is not
  necessarily what a windowed browser does, so read the per-frame numbers as
  orders of magnitude and the shape of their growth, not as budgets.
- The synchronous probes time JavaScript. A canvas rasterizes inside the call;
  an svg path only marks itself dirty, so its paint lands outside the timed
  region. The `forced` column calls `getBBox()` to pull the reparse back in,
  which still leaves rasterization out for both.
