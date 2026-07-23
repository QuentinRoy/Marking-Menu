# API Guidelines Audit — PR #126 (`feat/new-item-api`)

Tracking document for violations of the API design guidelines (function
parameters / named objects / object shape). Each item lists the location, the
current shape, the target shape, and a status indicator.

Status legend: ✅ fixed · ⬜ pending

Note on scope: the guidelines primarily target exported/public API surfaces.
Violations in internal helpers are listed separately at the end so they can be
prioritized (or waived) explicitly.

---

## 1. Exported API violations

### 1.1 `connectLayout` — too many positional parameters ✅

- **File:** `src/layout/connect.js:21`
- **Current:**
  ```js
  connectLayout(parentDOM, navigation$, createMenuLayout, createUpperStrokeCanvas, createLowerStrokeCanvas, createGestureFeedback, log)
  ```
- **Violation:** 7 positional parameters, including 4 same-type factory
  functions whose order must be memorized, plus a trailing `log` dependency.
- **Target:**
  ```js
  connectLayout({
    parent,
    navigation$,
    createMenuLayout,
    createUpperStrokeCanvas,
    createLowerStrokeCanvas,
    createGestureFeedback,
    log,
  })
  ```
- **Call sites to update:** `src/main.js` (the `connectLayout(...)` call), `src/layout/connect.test.js`.

### 1.2 `MMItem` constructor — positional same-type triple ✅

- **File:** `src/model.js:19`
- **Current:**
  ```js
  new MMItem(id, label, angle, { parent, children })
  ```
- **Violation:** three positional params of which two are `string` (`id`,
  `label`) — order must be memorized; this is a domain constructor likely to
  grow. The mixed `positional + options` style is exactly the "Avoid" pattern
  (`updateRubric(rubricId, { patch })`).
- **Target:**
  ```js
  new MMItem({ id, label, angle, parent, children })
  ```
- **Call sites to update:** `src/model.js` (`recursivelyCreateModelItems`, `createModel`), `src/model.test.js`.

### 1.3 `dwellings` — positional numbers + positional optional scheduler ✅

- **File:** `src/move/dwelling.js:23`
- **Current:**
  ```js
  dwellings(drag$, delay, movementsThreshold = 0, scheduler = undefined)
  ```
- **Violation:** `delay` and `movementsThreshold` are two same-type positional
  numbers; a fourth positional optional arg (`scheduler`) forces callers to
  pass earlier args they may not care about. Exported from `src/move/index.js`.
- **Target (primary positional + options object):**
  ```js
  dwellings(drag$, { delay, movementsThreshold = 0, scheduler })
  ```
- **Call sites to update:** `src/navigation/navigation.js` (×2), `src/navigation/novice-navigation.js` (`menuSelection`), `src/move/dwelling.test.js`.

### 1.4 `walkMMModel` — positional model/segments + positional optional index ✅

- **File:** `src/recognizer/recognize-mm-stroke.js:30`
- **Current:**
  ```js
  walkMMModel(model, segments, startIndex = 0)
  ```
- **Violation:** exported helper with a positional optional `startIndex` —
  call sites cannot pass `startIndex` without the rest, and recursion
  currently relies on positional ordering.
- **Target:**
  ```js
  walkMMModel({ model, segments, startIndex = 0 })
  ```
  (or keep `model` positional + `{ segments, startIndex }` — decide once and
  apply consistently with `findMMItem`, see 1.5).
- **Call sites to update:** internal recursion in the same file, `src/recognizer/recognize-mm-stroke.test.js`.

### 1.5 `findMMItem` — positional domain triple ✅

- **File:** `src/recognizer/recognize-mm-stroke.js:74`
- **Current:**
  ```js
  findMMItem(model, segments, maxDepth = model.getMaxDepth())
  ```
- **Violation:** same family as `walkMMModel`; positional optional `maxDepth`.
- **Target:**
  ```js
  findMMItem({ model, segments, maxDepth = model.getMaxDepth() })
  ```
  (must match the convention chosen for 1.4).
- **Call sites to update:** `recognizeMMStroke` in the same file, `src/recognizer/recognize-mm-stroke.test.js`.

### 1.6 `getStrokeArticulationPoints` — positional same-type numbers ✅

- **File:** `src/recognizer/articulation-points.js:25`
- **Current:**
  ```js
  getStrokeArticulationPoints(stroke, expectedSegmentLength, angleThreshold)
  ```
- **Violation:** two same-type positional numbers whose order must be
  memorized.
- **Target (primary positional + options object):**
  ```js
  getStrokeArticulationPoints(stroke, { expectedSegmentLength, angleThreshold })
  ```
- **Call sites to update:** `src/recognizer/recognize-mm-stroke.js`, `src/recognizer/articulation-points.test.js`.

### 1.7 `createStrokeCanvas` — inconsistent mixed style within the layout family ✅

- **File:** `src/layout/stroke.js:17`
- **Current:**
  ```js
  createStrokeCanvas(parent, { doc, lineWidth, lineColor, pointRadius, pointColor, ptSize })
  ```
- **Violation:** the sibling factory `createMenuLayout` (`src/layout/menu.js`)
  already takes a single fully-named config object including `parent`. The two
  factories are used side by side in `connectLayout`/`main.js` and should share
  one style. Per the guidelines: "if related functions use named objects, keep
  the same style."
- **Target:**
  ```js
  createStrokeCanvas({ parent, doc, lineWidth, lineColor, pointRadius, pointColor, ptSize })
  ```
- **Call sites to update:** `src/main.js` (×2), `src/layout/gesture-feedback.js`, `src/layout/stroke.test.js`.

### 1.8 `createGestureFeedback` — mixed positional + options, inconsistent with family ✅

- **File:** `src/layout/gesture-feedback.js:3`
- **Current:**
  ```js
  createGestureFeedback(parentDOM, { duration, strokeOptions, canceledStrokeOptions })
  ```
- **Violation:** same as 1.7 — should match the fully-named style of
  `createMenuLayout`.
- **Target:**
  ```js
  createGestureFeedback({ parent, duration, strokeOptions, canceledStrokeOptions })
  ```
- **Call sites to update:** `src/main.js`, `src/layout/gesture-feedback.test.js`.

### 1.9 `gestureFeedback.show` — positional boolean ✅

- **File:** `src/layout/gesture-feedback.js:9`
- **Current:**
  ```js
  show(stroke, isCanceled = false)
  // call site: gestureFeedback.show(stroke, isCanceled)
  ```
- **Violation:** positional boolean — explicitly called out in the guidelines
  (`renderRubric(rubric, true)` anti-pattern).
- **Target:**
  ```js
  show(stroke, { canceled = false })
  ```
- **Call sites to update:** `src/layout/connect.js` (`showGestureFeedback`, which itself takes positional `isCanceled` — rename/convert to an object or derive inside), `src/layout/gesture-feedback.test.js`.

### 1.10 `watchDrags` — positional optional array of factories ✅

- **File:** `src/move/linear-drag.js:65`
- **Current:**
  ```js
  watchDrags(rootDOM, dragObsFactories = [touchDrags, mouseDrags])
  ```
- **Violation:** positional optional second arg of a different type family;
  per guidelines this is "primary positional + options object" territory.
- **Target:**
  ```js
  watchDrags(rootDOM, { dragObsFactories = [touchDrags, mouseDrags] } = {})
  ```
- **Call sites to update:** `src/main.js`, `src/move/linear-drag.test.js`.

### 1.11 `navigation` / `navigationFromDrag` — trailing positional override function ✅

- **File:** `src/navigation/navigation.js:148` and `:95`
- **Current:**
  ```js
  navigation(drags$, menu, options, navigationFromDrag_ = navigationFromDrag)
  navigationFromDrag(drag$, start, model, options, { confirmedExpertNavigationHOO, confirmedNoviceNavigationHOO, startup } = {})
  ```
- **Violation:** `navigation` takes a 4th positional dependency override; it
  should live inside the options object like the other HOO overrides
  (`confirmedExpertNavigationHOO`, etc. already do). `navigationFromDrag`
  chains 4 positional args — arguably acceptable as internal composition, but
  the override object style should be matched.
- **Target:**
  ```js
  navigation(drags$, menu, { navigationFromDrag: navigationFromDrag_ = navigationFromDrag, ...options })
  ```
- **Call sites to update:** `src/main.js`, `src/navigation/navigation.test.js`.

---

## 2. Internal helpers (not exported — confirm whether to fix or waive)

### 2.1 `segmentAngle(a, b)` — `src/recognizer/recognize-mm-stroke.js:43` ✅

Same-type positional pair of points. Called only as `segmentAngle(...seg.points)`. Candidate for waiver (small local helper) or `{ from, to }`.

**Waived:** small conventional helper with one unambiguous local call; the spread matches the segment point representation directly, and it is not exposed through the package entry point.

### 2.2 `findMiddlePointForMinAngle(pointA, pointC, pointList, { … })` — `src/recognizer/find-points.js:54` ✅

Two same-type positional points + a third positional list before the options. Exported from the module (used in tests). Target:
```js
findMiddlePointForMinAngle({ pointA, pointC, pointList, startIndex, endIndex })
```

### 2.3 `findNextPointFurtherThan(pointList, minDist, { … })` — `src/recognizer/find-points.js:20` ⬜

Positional `minDist` between list and options. Borderline; primary-positional + options could be `findNextPointFurtherThan(pointList, { minDist, ... })`.

### 2.4 `recursivelyCreateModelItems(items, baseId, parent)` — `src/model.js:103` ⬜

Positional optional `baseId`/`parent`. Internal recursion only; candidate for `({ items, baseId, parent })` or waiver.

### 2.5 `connectLayout` internal closures — `src/layout/connect.js` ⬜

`openMenu(model, position)`, `startUpperStroke(position)`, `showGestureFeedback(isCanceled)` etc. Local closures; `showGestureFeedback(isCanceled)` takes a positional boolean but is only called with a computed expression (`notification.type === 'cancel'`), so the call site stays readable — likely fine to waive per the "small local utilities" exception, but listed for completeness.

### 2.6 `utils.js` helpers — `mod`, `dist`, `angle`, `deltaAngle`, `toPolar`, `findMaxEntry` ⬜

`angle(a, b, c)` (three same-type points) and `findMaxEntry(list, comp)` are the least self-evident, but these are conventional math/collection helpers — the guidelines explicitly allow "small conventional helpers … when the order is widely understood". Likely waive; confirm.

---

## Conventions to keep consistent when fixing

- Factories in `src/layout/` should all take a single named config object including `parent` (match `createMenuLayout`).
- Recognizer/model "walk" helpers (`walkMMModel`, `findMMItem`) should share one convention.
- Dependency/override injection (HOOs, factories, `log`) goes inside the options object — no trailing positional override params.
- Update JSDoc `@param` blocks, tests, `README.md`, and `demo/script.js` alongside each fix.
