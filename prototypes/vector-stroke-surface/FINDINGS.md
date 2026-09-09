# Findings — vector stroke surface (#284)

**The claims hold.** An `<svg>` with `overflow: visible` paints outside its
element's box in Chrome, Firefox and Safari; it does not extend a scroll
container; `overflow: hidden` on the parent still clips it; it restacks by
sibling position exactly like the canvases; and its caps, joins and start
marker are indistinguishable from the canvas ones. Its JavaScript cost across a
whole gesture is in the same order as an incrementally-drawn canvas — but only
in the split-path spelling, and drawing speed turns out not to be what
separates the two surfaces anyway.

Measured with `measure.ts` in Playwright's Chromium 153, Firefox 155 and
WebKit 26.6 (Safari 26), headless on macOS, `devicePixelRatio` 2. Raw numbers
in `results.json`, tables at the bottom of this file.

## Overflow

**Yes, in all three.** A stroke starting inside a 200x150 parent and leaving it
by 260px to the right paints on all three engines: 1920 ink pixels in a region
that sits entirely outside the parent's box, against 0 for the canvas the
library builds today. The canvas control reproduces the defect #278 starts
from, in the same probe.

This is the load-bearing claim, and it is the least surprising one: the
outermost `<svg>` is the only element whose `overflow` the UA stylesheet sets
to `hidden`, and setting it back to `visible` is all it takes.

## Scroll area

**A path does not extend a scroll container; an oversized canvas does.** With
the parent inside a 400x300 `overflow: auto` container, painting 260px past the
parent's right edge leaves the container at `scrollWidth` 400 and `scrollHeight`
300 on all three engines. Sizing a canvas to hold the same ink — exactly to the
ink's bounding box, so this is the smallest any growth rule could be — takes
the container to 522x392. That happens mid-gesture, under the pointer: content
that was not scrollable becomes scrollable while the user is drawing on it.

What was _not_ observed is a scrollbar taking layout space: the container's
`clientWidth` stayed at 400 in all three engines, because these are macOS
overlay scrollbars. On a platform with classic scrollbars, or under
`scrollbar-gutter: stable`, the same growth also costs width. The measured
claim is the growth in scroll extents; the visible scrollbar follows from it
platform by platform.

## Containment

**`overflow: hidden` on the parent still clips the path.** 0 ink outside the
box, 960 inside, on all three engines. #281's opt-out survives the move to
vector without needing anything else.

## Cost per frame

At 1200 points, one point per animation frame, **no variant reliably misses a
frame**. In Chromium every variant, including the do-nothing control, held the
vsync interval for all 1200 frames with a maximum gap of 16.8ms. Firefox and
WebKit both drop frames in headless mode regardless of what is drawn — their
controls reported 1 and 100 gaps over 17ms against 0-3 and 82-179 for the
variants — so their counts separate nothing.

The frame-gap evidence is therefore weak in both directions: it says no variant
is anywhere near the budget at 1200 points, and it cannot rank them. An earlier
run did produce a single 33.4ms frame in Chromium at the moment
`canvas-incremental-growth` grew its canvas; that did not reproduce, so treat
it as a hint about where the risk sits rather than as a result.

Per-frame JavaScript timings are unusable for a different reason: every engine
coarsens `performance.now()` to between 0.1 and 1ms, which is the size of the
work being timed. The comparison below therefore times the whole stroke in one
synchronous run, where the total clears that floor.

Total JavaScript to accumulate a 1200-point stroke, Chromium / Firefox /
WebKit, in ms:

| Variant                                       | 1200 points     | 5000 points        |
| --------------------------------------------- | --------------- | ------------------ |
| `canvas-replay` (what the library does today) | 58.9 / 551 / 85 | 398 / 6198 / 1273  |
| `canvas-incremental`                          | 0.6 / 3 / 0     | 4.1 / 14 / 5       |
| `canvas-window-incremental`                   | 1.2 / 5 / 1     | 3.3 / 13 / 3       |
| `canvas-incremental-growth`                   | 20.7 / 11 / 1   | 488 / 64 / 13      |
| `svg-rebuild`                                 | 104 / 150 / 109 | 1677 / 2443 / 2094 |
| `svg-append`                                  | 27.8 / 22 / 34  | 477 / 349 / 529    |
| `svg-split`                                   | 3.3 / 2 / 5     | 15.9 / 15 / 23     |
| `svg-chunked`                                 | 3.1 / 3 / 4     | 12.6 / 13 / 17     |

`forceGeometry` is a no-op for the canvas variants, so their two columns in
the table at the bottom differ only by run order. That gap is the noise floor:
in Chromium `canvas-replay` at 1200 points measured 58.9ms in one column and
24.8ms in the other. Anything under about 3x is therefore not a result. Every
comparison below rests on a gap of 10x or more.

Three things fall out of it.

**Clear-and-replay is the expensive one, and it is what ships.** It redraws
every point on every frame, so its cost is quadratic in the stroke: 551ms of
JavaScript across a 1200-point gesture in Firefox, six seconds at 5000. It stays under the frame budget only because the per-frame slice at the
end of a 1200-point gesture is still under a millisecond.

**Appending to `d` is not enough.** Setting the attribute makes the engine
reparse all of it, so `svg-append` is quadratic too, just with a smaller
constant than rebuilding the string. Forcing the reparse into the timed region
(`getBBox()` after each point) is what exposes it: at 5000 points Firefox goes
from 349ms to 1634ms and WebKit from 529ms to 1285ms. Chromium does not move
the same way — 477ms plain against 230ms forced — so either it already parses
eagerly or `getBBox()` displaces work it would otherwise do later. Two engines
out of three show the reparse the ticket predicted, and the third does not
contradict it.

**Bounding what gets reparsed is what makes vector cheap.** Two spellings do
it. `svg-split` keeps a frozen path for the committed points and a short live
path for the last hundred; `svg-chunked` gives every hundred points their own
path, written while it is live and never touched again. Both land beside an
incrementally drawn canvas at gesture lengths — 13 to 17ms across a 5000-point
stroke, against 4 to 14ms for the canvas, and 3 to 4ms against 0.6 to 5ms at
1200 — and they part company well beyond them (see below).

## Whether incremental drawing is the real difference

**It is not raw drawing speed; it is growth invalidating the incremental
draw.** A canvas drawn incrementally is the cheapest surface measured, and it
stays that way exactly as long as the canvas is never resized. Adding the
growth #279 would introduce costs two things at once: the whole stroke has to
be replayed onto the zeroed backing store, and the element's box has to be
resized, which is the expensive half (see "Cost of growth"). In Chromium that combination takes the incremental canvas from 0.6ms to
21ms over a 1200-point stroke and from 4.1ms to 488ms over 5000 — from the
cheapest surface measured to a worse one than any vector spelling except a
naive rebuild.

A path surface never resizes, so its appended `d` is never invalidated. That is
the difference, and it is a difference of kind rather than of degree.

## Cost of growth

A 1600x1200 parent at `devicePixelRatio` 2 starts with a 3200x2400 backing
store — 30.7MB, matching the ticket's estimate — and grows to 6400x5600, or
137MB, over eight growth steps. The backing store came back all-zero after
every growth, on every engine, read back a pixel at a time: the replay is
genuinely forced, not assumed.

**The reallocation is not the expensive part.** Timing the three things a
growth does separately, mean and max ms per growth:

| Engine   | `canvas.width` | style + transform | replay 1200 points |
| -------- | -------------- | ----------------- | ------------------ |
| Chromium | 0.65 / 1.1     | 7.7 / 11.7        | 0.21 / 0.3         |
| Firefox  | 0.63 / 3       | 0 / 0             | 4.5 / 6            |
| WebKit   | 0.13 / 1       | 0.25 / 1          | 0.25 / 1           |

Setting `canvas.width` is cheap in all three, which contradicts the reading
that a 137MB reallocation is what a growth rule would have to pay for. What it
pays for is resizing a very large element's box — 7.7ms mean and 11.7ms max in
Chromium, most of a frame, while the pointer is moving — and, in Firefox,
redrawing the stroke onto the zeroed store. A surface that never resizes pays
none of the three.

## The window-sized canvas

Growth is what invalidates a canvas's incremental draw, so the obvious reply
is to never grow: size the canvas to the window once, at creation, and append
to it for the rest of its life. It removes everything the previous two
sections measure — no reallocation, no zeroed store, no forced replay, no
element resize — and it keeps the cheapest surface in the sweep.

Drawing into the larger backing store costs nothing extra:
`canvas-window-incremental`, appending one segment per point into a canvas
sized to the viewport, measured 1.2 / 5 / 1 ms across a 1200-point stroke
against 0.6 / 3 / 0 ms for the small incremental canvas — the same number,
inside the noise. The idea works on its own terms.

It moves the cost into the scroll container instead. Same 400x300
`overflow: auto` container, same escaping stroke, identical in all three
engines:

| Surface                                | Scroller after painting |
| -------------------------------------- | ----------------------- |
| `<svg>` path                           | 400x300 (unchanged)     |
| Canvas grown to fit the ink            | 522x392                 |
| Canvas sized to the window             | 1260x960                |
| Window canvas, shifted to the viewport | 1179x879                |

A canvas is a layout box wherever it is placed, and sizing it to the window
does not escape the box — it maximises it. Where the growth rule makes the
container scrollable only once a stroke runs far enough, a window-sized canvas
does it from the first frame of the first gesture.

### Getting the box out of the way

Three ways to stop a canvas contributing to the scroll extents, each measured
for all three things that matter at once: does ink still escape the parent,
does the parent's `overflow: hidden` still contain it, and does the scroll
container grow.

| Strategy                                   | Escapes | `overflow: hidden` contains | Scroller |
| ------------------------------------------ | ------- | --------------------------- | -------- |
| `position: absolute` (today, window-sized) | yes     | yes                         | 1260x960 |
| `overflow: clip` + `overflow-clip-margin`  | yes\*   | **yes**                     | 560x510  |
| `position: fixed`                          | yes     | **no**                      | 400x300  |
| Top layer (`popover`)                      | yes     | **no**                      | 400x300  |
| `<svg>` path, `position: absolute`         | yes     | yes                         | 400x300  |

\* Chromium and Firefox only. WebKit painted nothing outside the box:
`overflow-clip-margin` is not honoured there, so this strategy is dead on
Safari today.

Each row gives up something. `clip-margin` is the only canvas strategy that
keeps containment, and it does not remove the growth — it bounds it by the
margin, which is #279's question moved into CSS. `fixed` and the top layer
remove the growth completely and lose the parent's clip: ink painted 260px
outside a parent with `overflow: hidden` was still there, in all three
engines. Only the path has all three columns.

### Putting the menu in the top layer

The objection to the top layer — that the lower stroke could no longer sit
behind the menu — does not survive moving the menu there too. Ordering was
measured inside one top-layer element and it is the ordering that already
holds: the sampled colour was the last sibling's exactly (`0,0,255`,
`255,0,0`), and with the front two faded the blend matched the canvases'
(`95,96,64` against `95,95,63` in Chromium, exact in Firefox and WebKit).
`restack()` works unchanged inside a popover.

That combination — menu and surfaces together in one `popover=manual`, holding
a viewport-sized canvas — answers most of this map without vector at all: no
growth, no scroll extents, and the surface's origin becomes the viewport, so
`toLocalPoint` retires instead of needing the offset #280 and #282 exist for.
What it costs is the containment measured above (#281's CSS opt-out stops
working, and would have to come back as a JavaScript-maintained
`clip-path`), a hard floor of Chrome 114 / Safari 17 / Firefox 125, and
whatever a host's own modal `<dialog>` does when it opens above us.

It also crosses a line this map drew: "Tier 2: `position: fixed` and client
coordinates" is in #278's Out of scope, and reaching the same place through
the top layer is the same destination by another mechanism. Worth a decision
on the map, not a quiet adoption here.

### Three further costs

None of them measured here, all of them arithmetic or reading:

- **Around 31MB per surface.** A 1600x1200 viewport at `devicePixelRatio` 2
  is 3200x2400x4 bytes. Three surfaces live during a gesture and each
  completed gesture adds a feedback trace that outlives it, several at once,
  so the resident total is nearer 120-190MB.
- **The origin still moves.** Painting above and left of the parent — half
  the escape cases — needs the canvas at negative `left`/`top`, so its
  top-left stops being the parent's. That offset is what #280 and #282 exist
  for, and it is why `toLocalPoint` would have to change. A path anchored at
  the parent's origin never introduces it.
- **It resizes anyway, eventually.** A window resize or a `devicePixelRatio`
  change — dragging the window to another monitor — forces the reallocation
  back, and this map already counts never-resizing as an in-scope bug.

And `stroke` and `stroke-width` stay JavaScript options rather than CSS,
which is what #269 wanted from `::part(stroke)`.

**When it is the better answer.** A window-sized canvas answers #279 without
moving the drawing layer to vector, and it is the cheaper change by a wide
margin — provided the scroll extents are acceptable, or the top layer is on
the table to remove them. The path surface earns its keep against containment,
memory, resize handling and CSS styling, not against drawing speed.

### Chunked, not split

The split still rewrites its frozen path every hundred points, and that rewrite
is O(stroke), so its total stays quadratic — divided by the chunk size, but
quadratic. Chunking never rewrites anything, so its total is linear and the
only thing that grows is the element count. Run past any plausible gesture,
that is what the engines show:

| Points         | `svg-append` | `svg-split` | `svg-chunked` (elements) |
| -------------- | ------------ | ----------- | ------------------------ |
| Chromium 5000  | 471          | 21          | **13** (51)              |
| Chromium 10000 | 1895         | 46          | **24** (101)             |
| Chromium 20000 | 7741         | 125         | **51** (201)             |
| Firefox 5000   | 373          | 16          | **11** (51)              |
| Firefox 10000  | 1407         | 39          | **22** (101)             |
| Firefox 20000  | 5795         | 111         | **43** (201)             |
| WebKit 5000    | 534          | 23          | **16** (51)              |
| WebKit 10000   | 2111         | 53          | **35** (101)             |
| WebKit 20000   | 8299         | 152         | **64** (201)             |

Chunked doubles when the stroke doubles, in all three engines. Split closer to
triples. With the reparse forced the gap widens further: at 20000 points on
WebKit, 3330ms for the split against 484ms chunked.

None of this matters at 1200 points, where the two are 3.3ms and 3.1ms. It
matters for which one to specify: chunked is simpler to write, has no freeze
cadence to tune, and is the faster of the two at every length measured. The
price is one `<path>` per hundred points — 13 elements for a 1200-point
gesture, 201 at 20000.

## Round caps and joins

**Identical.** With `stroke-linecap`/`stroke-linejoin: round` against the
canvas `lineCap`/`lineJoin`, a 40-point spiral at stroke width 8 differs by 40
pixels out of 288,000 in Chromium, 38 in WebKit and 0 in Firefox — all of them
anti-aliasing along the edge of the stroke, and all in regions where both
surfaces painted (36,637 canvas ink pixels against 36,646 svg). A sharp zigzag
differs by 3 pixels in Chromium and 0 elsewhere; a two-point segment by 0
everywhere.

**One-point strokes paint nothing today, on either surface.** `ctx.moveTo`
without a `lineTo` paints nothing, and neither does a bare `M x y`. This is a
latent gap, not a regression: the library already draws nothing for the frame
between `pointerdown` and the first `pointermove`. The vector surface can close
it — `M x y L x y` paints a round dot (213 to 216 ink pixels, all three
engines) —
where a canvas would need a separate `arc` call.

## The start marker

**A `<circle>` covers it.** Against `drawPoint`'s filled arc: 79 differing
pixels of 288,000 in Chromium (59 where both painted), 13 in WebKit (all where
both painted), 0 in Firefox, with ink counts within 0.3%.

## Fading traces

**`<svg>` siblings restack and fade exactly like canvases.** Three overlapping
opaque strokes, reordered by `append()` without `z-index`: the sampled colour
was the last sibling's, exactly (`0,0,255`, `255,0,0`, `0,255,0`), in all three
orders, on all three engines, for both surfaces.

Fading several at once — the front-most at `opacity: 0.25` and the one behind
it at `0.5`, which is the arrangement `createGestureFeedback` produces — the
two surfaces composite to the same colour: `95,96,64` for svg against
`95,95,63` for canvas in Chromium, and an exact match in Firefox and WebKit.
Reversing the sibling order reverses the blend the same way for both. A faded
front sibling still paints in front, and `restack()` needs no change.

## Styling through `::part()`

Not one of the ticket's Settle bullets. It is measured because "What it
decides" claims #269 gains something here, and the claim was cheap to check.

**A path is stylable from outside its shadow root; a canvas is not.** A
`<path>` carrying `part="stroke"` inside a shadow root, with `stroke="#000"`
and `stroke-width="4"` set as presentation attributes the way the JavaScript
options would, computes to `rgb(0, 128, 255)` and `11px` under a
`div::part(stroke)` rule in the outer document — on all three engines. What
#269 wants from `::part(stroke)` is ordinary CSS on a path, and reachable only
through JavaScript options on a canvas.

## What this decides

The vector surface answers the question #279 was asked to answer, rather than
answering #279. Recommended:

- **#279 is moot.** There is no backing store to size.
- **#280 and #282** lose their subject: the surface never moves against the
  parent's origin, so no offset has to be threaded anywhere and `toLocalPoint`
  is untouched.
- **#278 shrinks** to #281 plus the two demo surfaces its hand-off rule needs.
- **#269 gains** stroke colour and width as ordinary CSS.
- **The alternative on the table is the window-sized canvas**, not the status
  quo. It is simpler and faster, and it trades the growth cost for a larger
  layout box, a moving origin, and ~31MB a surface. See "The window-sized
  canvas".
- **The drawing strategy has to move with the surface.** A path surface is only
  competitive when what gets reparsed each frame is bounded; a naive `d`
  rebuild is worse than what ships today. Whatever ticket lands the move has to
  specify chunked paths, not just the element.

## What this does not settle

- Headless engines on one macOS machine. Rasterization is not measured for
  either surface, on either the canvas or the path side; the frame-gap evidence
  covers it only indirectly, by nobody missing a frame.
- The stroke is a synthetic spiral, which turns more sharply than a real
  gesture and so has more distinct segments per pixel. Pessimistic, not
  optimistic.
- The freeze cadence in `svg-split` (100 points) is unexamined. The frozen
  path's `d` still grows without bound, so its reparse at freeze time is linear
  in the stroke; it was cheap up to 5000 points, and nothing here says where
  that stops being true.
- Nothing was measured with the menu, the machine, or a shadow root in the
  path's ancestry other than in the `::part()` probe.
- Each number is one run. The noise floor is visible in the canvas rows of the
  final table, where the same work was timed twice, and it is wide in Chromium.
- Machine state moves these numbers more than any of the differences under 3x.
  An earlier sweep straddled a system sleep and ran on battery, and Firefox's
  whole column came back 2-3x high (`canvas-replay` at 1200 points: 1242ms
  against 551ms here). The numbers recorded are from a sweep that ran on mains
  power without interruption.

---

# Numbers

Generated by `yarn prototype:vector-stroke:report` from `results.json`.

## Overflow and containment

Ink found strictly outside the parent box (and inside it, as a control).

| engine   | surface       | parent overflow | ink outside | ink inside |
| -------- | ------------- | --------------- | ----------- | ---------- |
| chromium | svg           | visible         | 1920        | 960        |
| chromium | svg           | hidden          | 0           | 960        |
| chromium | canvas        | visible         | 0           | 960        |
| chromium | canvas        | hidden          | 0           | 960        |
| chromium | canvas-window | visible         | 1920        | 960        |
| chromium | canvas-window | hidden          | 0           | 960        |
| chromium | canvas-window | visible         | 1920        | 960        |
| chromium | canvas-window | hidden          | 1920        | 960        |
| chromium | canvas-window | visible         | 1920        | 960        |
| chromium | canvas-window | hidden          | 1920        | 960        |
| chromium | svg           | visible         | 1920        | 960        |
| chromium | svg           | hidden          | 1920        | 960        |
| firefox  | svg           | visible         | 1920        | 960        |
| firefox  | svg           | hidden          | 0           | 960        |
| firefox  | canvas        | visible         | 0           | 960        |
| firefox  | canvas        | hidden          | 0           | 960        |
| firefox  | canvas-window | visible         | 1920        | 960        |
| firefox  | canvas-window | hidden          | 0           | 960        |
| firefox  | canvas-window | visible         | 1920        | 960        |
| firefox  | canvas-window | hidden          | 1920        | 960        |
| firefox  | canvas-window | visible         | 1920        | 960        |
| firefox  | canvas-window | hidden          | 1920        | 960        |
| firefox  | svg           | visible         | 1920        | 960        |
| firefox  | svg           | hidden          | 1920        | 960        |
| webkit   | svg           | visible         | 1920        | 960        |
| webkit   | svg           | hidden          | 0           | 960        |
| webkit   | canvas        | visible         | 0           | 960        |
| webkit   | canvas        | hidden          | 0           | 960        |
| webkit   | canvas-window | visible         | 0           | 960        |
| webkit   | canvas-window | hidden          | 0           | 960        |
| webkit   | canvas-window | visible         | 1920        | 960        |
| webkit   | canvas-window | hidden          | 1920        | 960        |
| webkit   | canvas-window | visible         | 1920        | 960        |
| webkit   | canvas-window | hidden          | 1920        | 960        |
| webkit   | svg           | visible         | 1920        | 960        |
| webkit   | svg           | hidden          | 1920        | 960        |

## Scroll area

The parent sits in a 400x300 `overflow: auto` container.

| engine   | surface                | scrollWidth | scrollHeight | clientWidth (scrollbar) |
| -------- | ---------------------- | ----------- | ------------ | ----------------------- |
| chromium | svg                    | 400 → 400   | 300 → 300    | 400 → 400               |
| chromium | canvas                 | 400 → 522   | 300 → 392    | 400 → 400               |
| chromium | canvas-window          | 400 → 1260  | 300 → 960    | 400 → 400               |
| chromium | canvas-window-anchored | 400 → 1179  | 300 → 879    | 400 → 400               |
| chromium | canvas-window          | 400 → 560   | 300 → 510    | 400 → 400               |
| chromium | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| chromium | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| firefox  | svg                    | 400 → 400   | 300 → 300    | 400 → 400               |
| firefox  | canvas                 | 400 → 522   | 300 → 392    | 400 → 400               |
| firefox  | canvas-window          | 400 → 1260  | 300 → 960    | 400 → 400               |
| firefox  | canvas-window-anchored | 400 → 1179  | 300 → 879    | 400 → 400               |
| firefox  | canvas-window          | 400 → 560   | 300 → 510    | 400 → 400               |
| firefox  | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| firefox  | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| webkit   | svg                    | 400 → 400   | 300 → 300    | 400 → 400               |
| webkit   | canvas                 | 400 → 522   | 300 → 392    | 400 → 400               |
| webkit   | canvas-window          | 400 → 1260  | 300 → 960    | 400 → 400               |
| webkit   | canvas-window-anchored | 400 → 1179  | 300 → 879    | 400 → 400               |
| webkit   | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| webkit   | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |
| webkit   | canvas-window          | 400 → 400   | 300 → 300    | 400 → 400               |

## Fidelity

Same geometry, same stroke width, pixel-diffed at devicePixelRatio 2.

Differing pixels are split by whether both surfaces painted there: `both` is the stroke's own anti-aliased edge, `one` is ground covered by one surface and not the other.

| case               | chromium: differing (both/one), max channel diff | firefox: differing (both/one), max channel diff | webkit: differing (both/one), max channel diff |
| ------------------ | ------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------- |
| polyline           | 39 (31/8), 56                                    | 0 (0/0), 0                                      | 38 (37/1), 108                                 |
| zigzag             | 3 (3/0), 39                                      | 0 (0/0), 0                                      | 0 (0/0), 17                                    |
| two-point          | 0 (0/0), 0                                       | 0 (0/0), 0                                      | 0 (0/0), 29                                    |
| single-point       | 0 (0/0), 0                                       | 0 (0/0), 0                                      | 0 (0/0), 0                                     |
| start-marker       | 79 (59/20), 47                                   | 0 (0/0), 1                                      | 13 (13/0), 71                                  |
| single-point (M…L) | 218 (0/218), 255                                 | 218 (0/218), 255                                | 216 (0/216), 255                               |

| case               | chromium: canvas ink / svg ink | firefox: canvas ink / svg ink | webkit: canvas ink / svg ink |
| ------------------ | ------------------------------ | ----------------------------- | ---------------------------- |
| polyline           | 36637 / 36646                  | 36633 / 36633                 | 36768 / 36657                |
| zigzag             | 15284 / 15279                  | 15284 / 15284                 | 15296 / 15283                |
| two-point          | 4693 / 4693                    | 4693 / 4693                   | 4696 / 4688                  |
| single-point       | 0 / 0                          | 0 / 0                         | 0 / 0                        |
| start-marker       | 33463 / 33440                  | 33472 / 33472                 | 33549 / 33473                |
| single-point (M…L) | 0 / 213                        | 0 / 214                       | 0 / 216                      |

## Restacking siblings (no z-index)

| engine   | surface | sibling order | faded   | expected top | sampled centre (rgb) |
| -------- | ------- | ------------- | ------- | ------------ | -------------------- |
| chromium | svg     | abc           | none    | #00f         | 0,0,255              |
| chromium | svg     | cba           | none    | #f00         | 255,0,0              |
| chromium | svg     | acb           | none    | #0f0         | 0,255,0              |
| chromium | svg     | abc           | top two | blend        | 95,96,64             |
| chromium | svg     | cba           | top two | blend        | 64,96,95             |
| chromium | svg     | abc           | none    | #00f         | 0,0,255              |
| chromium | svg     | cba           | none    | #f00         | 255,0,0              |
| chromium | svg     | abc           | top two | blend        | 95,96,64             |
| chromium | canvas  | abc           | none    | #00f         | 0,0,255              |
| chromium | canvas  | cba           | none    | #f00         | 255,0,0              |
| chromium | canvas  | acb           | none    | #0f0         | 0,255,0              |
| chromium | canvas  | abc           | top two | blend        | 95,95,63             |
| chromium | canvas  | cba           | top two | blend        | 63,95,95             |
| chromium | canvas  | abc           | none    | #00f         | 0,0,255              |
| chromium | canvas  | cba           | none    | #f00         | 255,0,0              |
| chromium | canvas  | abc           | top two | blend        | 95,95,63             |
| firefox  | svg     | abc           | none    | #00f         | 0,0,255              |
| firefox  | svg     | cba           | none    | #f00         | 255,0,0              |
| firefox  | svg     | acb           | none    | #0f0         | 0,255,0              |
| firefox  | svg     | abc           | top two | blend        | 94,95,64             |
| firefox  | svg     | cba           | top two | blend        | 64,95,94             |
| firefox  | svg     | abc           | none    | #00f         | 0,0,255              |
| firefox  | svg     | cba           | none    | #f00         | 255,0,0              |
| firefox  | svg     | abc           | top two | blend        | 94,95,64             |
| firefox  | canvas  | abc           | none    | #00f         | 0,0,255              |
| firefox  | canvas  | cba           | none    | #f00         | 255,0,0              |
| firefox  | canvas  | acb           | none    | #0f0         | 0,255,0              |
| firefox  | canvas  | abc           | top two | blend        | 94,95,64             |
| firefox  | canvas  | cba           | top two | blend        | 64,95,94             |
| firefox  | canvas  | abc           | none    | #00f         | 0,0,255              |
| firefox  | canvas  | cba           | none    | #f00         | 255,0,0              |
| firefox  | canvas  | abc           | top two | blend        | 94,95,64             |
| webkit   | svg     | abc           | none    | #00f         | 0,0,255              |
| webkit   | svg     | cba           | none    | #f00         | 255,0,0              |
| webkit   | svg     | acb           | none    | #0f0         | 0,255,0              |
| webkit   | svg     | abc           | top two | blend        | 95,96,64             |
| webkit   | svg     | cba           | top two | blend        | 64,96,95             |
| webkit   | svg     | abc           | none    | #00f         | 0,0,255              |
| webkit   | svg     | cba           | none    | #f00         | 255,0,0              |
| webkit   | svg     | abc           | top two | blend        | 95,96,64             |
| webkit   | canvas  | abc           | none    | #00f         | 0,0,255              |
| webkit   | canvas  | cba           | none    | #f00         | 255,0,0              |
| webkit   | canvas  | acb           | none    | #0f0         | 0,255,0              |
| webkit   | canvas  | abc           | top two | blend        | 95,96,64             |
| webkit   | canvas  | cba           | top two | blend        | 64,96,95             |
| webkit   | canvas  | abc           | none    | #00f         | 0,0,255              |
| webkit   | canvas  | cba           | none    | #f00         | 255,0,0              |
| webkit   | canvas  | abc           | top two | blend        | 95,96,64             |

## Styling a path through `::part()`

| engine   | computed stroke  | computed stroke-width | attributes it overrode |
| -------- | ---------------- | --------------------- | ---------------------- |
| chromium | rgb(0, 128, 255) | 11px                  | #000 / 4               |
| firefox  | rgb(0, 128, 255) | 11px                  | #000 / 4               |
| webkit   | rgb(0, 128, 255) | 11px                  | #000 / 4               |

## Cost of growing a canvas

A 1600x1200 parent at devicePixelRatio 2, grown by 200px eight times, replaying a 1200-point stroke after each growth.

| engine   | final backing store | assign (mean/max ms) | assign + replay (mean/max ms) |
| -------- | ------------------- | -------------------- | ----------------------------- |
| chromium | 6400x5600 (137 MB)  | 0.65 / 1.1           | 8.587 / 12.9                  |
| firefox  | 6400x5600 (137 MB)  | 0.625 / 3            | 5.125 / 7                     |
| webkit   | 6400x5600 (137 MB)  | 0.125 / 1            | 0.625 / 2                     |

## Per-frame cost, one point per animation frame

| variant                   | chromium frame gap p50/p95/max, >17ms | firefox frame gap p50/p95/max, >17ms | webkit frame gap p50/p95/max, >17ms |
| ------------------------- | ------------------------------------- | ------------------------------------ | ----------------------------------- |
| none                      | 16.7/16.7/16.8, 0                     | 8.32/9.26/17.3, 1                    | 17/18/41, 100                       |
| canvas-replay             | 16.7/16.7/16.8, 0                     | 8.32/9.28/32.74, 3                   | 17/18/24, 86                        |
| canvas-incremental        | 16.7/16.8/16.8, 0                     | 8.34/9.12/33.34, 2                   | 17/18/21, 95                        |
| canvas-window-incremental | 16.7/16.7/16.8, 0                     | 8.34/8.96/17.56, 1                   | 17/18/22, 82                        |
| canvas-incremental-growth | 16.7/16.7/16.8, 0                     | 8.34/9.1/24.22, 1                    | 17/18/22, 98                        |
| svg-rebuild               | 16.7/16.7/16.8, 0                     | 8.34/9.3/17.48, 1                    | 17/18/20, 103                       |
| svg-append                | 16.7/16.7/16.8, 0                     | 8.34/9.3/24.98, 2                    | 17/18/24, 121                       |
| svg-split                 | 16.7/16.7/16.8, 0                     | 8.34/9.24/16.84, 0                   | 17/18/20, 118                       |
| svg-chunked               | 16.7/16.8/16.8, 0                     | 8.34/9.14/16.66, 0                   | 16/19/25, 179                       |

## Synchronous cost of a whole stroke (ms)

Total time to push every point, timed once so the result clears the engines' timer coarsening. `forced` calls `getBBox()` after each point, which is what makes an engine reparse the `d` it was handed.

### attribute set only

| variant                   | chromium @200 | chromium @1200 | chromium @5000 | firefox @200 | firefox @1200 | firefox @5000 | webkit @200 | webkit @1200 | webkit @5000 |
| ------------------------- | ------------- | -------------- | -------------- | ------------ | ------------- | ------------- | ----------- | ------------ | ------------ |
| none                      | 0.1           | 0.2            | 0.4            | 1            | 0             | 1             | 0           | 1            | 0            |
| canvas-replay             | 5.1           | 58.9           | 398            | 82           | 551           | 6198          | 4           | 85           | 1273         |
| canvas-incremental        | 0.2           | 0.6            | 4.1            | 3            | 3             | 14            | 0           | 0            | 5            |
| canvas-window-incremental | 0.2           | 1.2            | 3.3            | 2            | 5             | 13            | 0           | 1            | 3            |
| canvas-incremental-growth | 1.4           | 20.7           | 487.7          | 2            | 11            | 64            | 1           | 1            | 13           |
| svg-rebuild               | 2.9           | 104.2          | 1676.6         | 4            | 150           | 2443          | 3           | 109          | 2094         |
| svg-append                | 0.9           | 27.8           | 476.6          | 1            | 22            | 349           | 1           | 34           | 529          |
| svg-split                 | 0.6           | 3.3            | 15.9           | 1            | 2             | 15            | 0           | 5            | 23           |
| svg-chunked               | 0.6           | 3.1            | 12.6           | 0            | 3             | 13            | 1           | 4            | 17           |

### reparse forced

| variant                   | chromium @200 | chromium @1200 | chromium @5000 | firefox @200 | firefox @1200 | firefox @5000 | webkit @200 | webkit @1200 | webkit @5000 |
| ------------------------- | ------------- | -------------- | -------------- | ------------ | ------------- | ------------- | ----------- | ------------ | ------------ |
| none                      | 0             | 0.1            | 0.3            | 0            | 1             | 0             | 0           | 0            | 1            |
| canvas-replay             | 1.6           | 24.8           | 397.7          | 65           | 553           | 6218          | 2           | 66           | 1260         |
| canvas-incremental        | 0.3           | 1.2            | 3.6            | 2            | 5             | 13            | 0           | 1            | 4            |
| canvas-window-incremental | 0.3           | 1.5            | 3.3            | 2            | 5             | 14            | 0           | 1            | 4            |
| canvas-incremental-growth | 1.7           | 20.8           | 486.1          | 3            | 12            | 67            | 0           | 2            | 20           |
| svg-rebuild               | 4.6           | 108.1          | 1778.5         | 10           | 203           | 3689          | 10          | 178          | 2753         |
| svg-append                | 1.4           | 17             | 229.5          | 6            | 82            | 1634          | 6           | 91           | 1285         |
| svg-split                 | 1.2           | 6.1            | 29.8           | 5            | 22            | 108           | 5           | 35           | 287          |
| svg-chunked               | 1.4           | 7              | 30.9           | 5            | 21            | 96            | 4           | 26           | 105          |

## Where the svg spellings diverge (ms)

Longer strokes than a gesture can plausibly produce, to separate the split's residual quadratic — it rewrites the frozen path every 100 points — from the chunked variant, which never rewrites anything. `el` is how many `<path>` elements the variant left in the DOM.

### attribute set only

| variant     | chromium @5000 | chromium @10000 | chromium @20000 | firefox @5000 | firefox @10000 | firefox @20000 | webkit @5000 | webkit @10000 | webkit @20000 |
| ----------- | -------------- | --------------- | --------------- | ------------- | -------------- | -------------- | ------------ | ------------- | ------------- |
| svg-append  | 471.4 (1 el)   | 1894.5 (1 el)   | 7741.3 (1 el)   | 373 (1 el)    | 1407 (1 el)    | 5795 (1 el)    | 534 (1 el)   | 2111 (1 el)   | 8299 (1 el)   |
| svg-split   | 20.9 (1 el)    | 45.7 (1 el)     | 125.4 (1 el)    | 16 (1 el)     | 39 (1 el)      | 111 (1 el)     | 23 (1 el)    | 53 (1 el)     | 152 (1 el)    |
| svg-chunked | 12.6 (51 el)   | 24.4 (101 el)   | 51.4 (201 el)   | 11 (51 el)    | 22 (101 el)    | 43 (201 el)    | 16 (51 el)   | 35 (101 el)   | 64 (201 el)   |

### reparse forced

| variant     | chromium @5000 | chromium @10000 | chromium @20000 | firefox @5000 | firefox @10000 | firefox @20000 | webkit @5000 | webkit @10000 | webkit @20000 |
| ----------- | -------------- | --------------- | --------------- | ------------- | -------------- | -------------- | ------------ | ------------- | ------------- |
| svg-append  | 220.2 (1 el)   | 880.6 (1 el)    | 10051.3 (1 el)  | 1557 (1 el)   | 7724 (1 el)    | 33658 (1 el)   | 1279 (1 el)  | 4967 (1 el)   | 19415 (1 el)  |
| svg-split   | 33.9 (1 el)    | 345.2 (1 el)    | 235.5 (1 el)    | 106 (1 el)    | 274 (1 el)     | 773 (1 el)     | 290 (1 el)   | 940 (1 el)    | 3330 (1 el)   |
| svg-chunked | 39.5 (51 el)   | 79.5 (101 el)   | 209.1 (201 el)  | 93 (51 el)    | 199 (101 el)   | 458 (201 el)   | 111 (51 el)  | 219 (101 el)  | 484 (201 el)  |
