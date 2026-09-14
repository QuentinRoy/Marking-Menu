# Menu-opening indicator — prototype

Throwaway. Built to explore the look of
[#309](https://github.com/QuentinRoy/Marking-Menu/issues/309): a growing
indicator shown during the dwell that precedes novice mode (or a submenu
reopen), instead of the dot popping in with no warning.

Nothing here imports the library; the dwell timing rules (`movementsThreshold`,
`noviceDwellingTime`) are hand-copied from `src/engine/machine.ts` closely
enough to feel the real cadence — the armed-then-anchored restart behaviour —
without pulling in the actual state machine.

## Run it

Open `index.html`. Nothing to build, nothing to serve.

Press and drag on the stage like you're drawing a marking-menu stroke, then
slow down or stop: the indicator grows while the pointer stays put, same as
the real dwell. Release to cancel and try again.

## What's on the page

- **Tabs** (`#none` / `#pie` / `#ring` in the URL) switch between three
  candidate treatments:
  - `none` — today's behaviour, the dot just appears.
  - `pie` — a filled sector grows from 0° to 360° at the dot's own radius, so
    at completion it is already pixel-identical to the dot.
  - `ring` — a thin ring sweeps around, then thickens into a solid disc over
    the closing stretch of the delay; the outer edge never moves, so it also
    closes into the dot without a jump.
- Sliders for delay, movement threshold, dot radius, and the background
  circle's opacity (its size always matches the dot/pie's own radius exactly
  — no separate halo), plus a toggle for aligning the indicator's start angle
  with the stroke's direction (the acceptance criteria's "mostly invisible at
  start" — a thin sliver overlapping the line you're already drawing reads
  very differently from one appearing at a fixed angle).
- The indicator sits at the current dwell anchor, not the gesture's origin:
  in expert mode that anchor moves with the pointer, and the menu is about
  to open right there — so the indicator stays under the cursor, same as the
  real `dwellAnchor` in `src/engine/machine.ts`.
- A readout of the current phase/progress/angle, for anything the eye
  might miss.
