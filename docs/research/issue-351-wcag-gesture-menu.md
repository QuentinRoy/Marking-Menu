# Issue #351: WCAG 2.2 AA criteria for a gesture-driven radial menu

## Summary

WCAG conformance is defined for full pages, not components, so the library cannot conform on its own. It can only avoid making the host page fail. Of the criteria asked about, the library fails 4.1.2 today and has no conformance path except its own semantics. 2.5.1 and 2.5.7 fail for the library alone and are met at page level by the host's equivalent command path. 1.4.3, 1.4.11 and 2.5.2 pass with the default theme. 4.1.3 does not apply to the library. 2.3.3 (AAA) fails because the opening indicator grows regardless of `prefers-reduced-motion`.

| Criterion                          | Level | Today                                                            | Owner                                                    |
| ---------------------------------- | ----- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| 1.4.3 Contrast (Minimum)           | AA    | Pass (default theme)                                             | Library for defaults; host for custom `--mm-*` colors    |
| 1.4.11 Non-text Contrast           | AA    | Pass on a light host background, with one uncertainty (wedges)   | Library for defaults; host for theme and page background |
| 2.3.3 Animation from Interactions  | AAA   | Fail (indicator growth ignores reduced motion)                   | Library                                                  |
| 2.5.1 Pointer Gestures             | A     | Fail for the library alone                                       | Host (equivalent command path)                           |
| 2.5.2 Pointer Cancellation         | A     | Pass (up-event completion, with an abort)                        | Library                                                  |
| 2.5.7 Dragging Movements           | AA    | Fail for the library alone                                       | Host (equivalent command path)                           |
| 4.1.2 Name, Role, Value            | A     | Fail (no roles, no exposed active state)                         | Library                                                  |
| 4.1.3 Status Messages              | AA    | Not applicable to the library (it emits no status messages)      | Host (`select` announcement)                             |
| 2.1.1 Keyboard (not in the ticket) | A     | Fail for the library alone; path exception does not apply        | Host (same command path)                                 |
| 1.4.1 Use of Color (not in ticket) | A     | Pass for the active item; uncertain for canceled-stroke feedback | Library                                                  |

All sources are the [WCAG 2.2 Recommendation (12 December 2024)](https://www.w3.org/TR/WCAG22/) and its Understanding documents. W3C publishes no separate component-level conformance model for web content. WCAG2ICT covers non-web software and does not apply here.

## Conformance scope: whose job it is

Conformance requirement 5.2.2 says conformance "is defined for full web pages" and cannot be achieved if part of the page is excluded. [WCAG 2.2 §5.2.2](https://www.w3.org/TR/WCAG22/#cc2) [Understanding Conformance](https://www.w3.org/WAI/WCAG22/Understanding/conformance.html). The consequence for a library:

- No library can claim WCAG conformance. It can state which criteria it satisfies by itself and which ones it leaves for the host to satisfy.
- Criteria phrased as "all functionality ... can be operated" (2.1.1, 2.5.1, 2.5.7) are about functionality on the page. The host providing the same commands another way meets them.
- Criteria phrased about a component's own properties (4.1.2's name, role and state; 1.4.3/1.4.11 colors) can only be met by the component's own markup and styles. A host path elsewhere does not help.

This supports the map's premise: the host owns the non-gesture path, and the library owns semantics and its default theme.

## 1.4.3 Contrast (Minimum): pass

Text needs 4.5:1 (3:1 for large text, at least 24px or 18.5px bold). [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

Default label colors ([src/layout/menu.css:186-192](../../src/layout/menu.css)), with ratios computed using the WCAG relative-luminance formula:

| Pair                         | Colors                 | Ratio   |
| ---------------------------- | ---------------------- | ------- |
| Label on plate               | `#333333` on `#f2f2f2` | 11.29:1 |
| Active label on active plate | `#000000` on `#d9d9d9` | 14.88:1 |

Both pass at 4.5:1 regardless of the 20px default size. Labels sit on their own plate, so the host background does not affect them. Custom `--mm-plate-*` colors are the host's responsibility (map: "Label contrast against arbitrary host backgrounds: the host owns the theme").

## 1.4.11 Non-text Contrast: pass on light backgrounds, one uncertainty

1.4.11 requires 3:1 against adjacent colors for visual information needed to identify UI components and their states, and for graphical objects needed to understand content. The Understanding document says:

- Text-only controls need no visible boundary: the text alone shows the control is there.
- A color change that tells two states apart does not need 3:1 when the two colors are not adjacent.
- The pointer cursor is out of scope.

[Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

Defaults ([src/layout/menu.css:186-256](../../src/layout/menu.css)) against a white host background, computed:

| Graphic                               | Colors                  | Ratio   | Assessment                                   |
| ------------------------------------- | ----------------------- | ------- | -------------------------------------------- |
| Stroke, indicator dot                 | `#000000` on `#ffffff`  | 21:1    | Pass                                         |
| Lower (parent-menu) stroke            | `#787878` on `#ffffff`  | 4.42:1  | Pass                                         |
| Canceled feedback stroke              | `#de6b52` on `#ffffff`  | 3.32:1  | Pass (barely)                                |
| Indicator dot on indicator background | `#000000` on `#f2f2f2`  | 18.76:1 | Pass                                         |
| Plate and wedge on page               | `#f2f2f2` on `#ffffff`  | 1.12:1  | Probably not required: labels identify items |
| Active vs. inactive plate or wedge    | `#d9d9d9` vs. `#f2f2f2` | 1.26:1  | Not required between states; see 1.4.1       |

Verified: the stroke and indicator pass on a white page. Uncertain: whether a wedge is "required to understand" the item's direction. The label's position already conveys direction, which is why the table reads it as not required. A dark host page reverses the stroke results: black on black fails. The page background is the host's, so the host must set `--mm-stroke-color` to match.

## 2.3.3 Animation from Interactions (AAA, note only): fail

2.3.3 requires that motion animation triggered by interaction can be disabled unless essential. Motion animation means added intermediate steps that give an illusion of movement. Color, blur and opacity changes that do not change perceived size, shape or position are excluded. Movement the user controls directly, such as scrolling, counts as essential. [Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

In the code:

- `menu.css` has no `transition` or `animation` and no `prefers-reduced-motion` query. Menus appear and disappear in one frame. Feedback strokes are removed by `setTimeout` without fading ([src/layout/gesture-feedback.ts:75-80](../../src/layout/gesture-feedback.ts)).
- The stroke follows the pointer. That movement is user-controlled, so it is exempt like scrolling.
- **The opening indicator animates size.** A dot grows from half the stroke width to the full radius on a `requestAnimationFrame` clock ([src/layout/indicator.ts:70-77](../../src/layout/indicator.ts), [src/engine/renderer.ts:97](../../src/engine/renderer.ts)). It runs during startup and over a non-leaf active item in novice mode ([src/engine/layout-view.ts:55-67](../../src/engine/layout-view.ts)). The growth changes perceived size, so it is motion animation. It is not essential, because an opacity or fill-level change could show the same dwell progress. Nothing turns it off today.

This is AAA and outside the AA target. The map's `prefers-reduced-motion` work covers it.

## 2.5.1 Pointer Gestures: fail for the library, host path meets it

Normative text: "All functionality that uses multipoint or path-based gestures for operation can be operated with a single pointer without a path-based gesture, unless a multipoint or path-based gesture is essential." A path-based gesture is one "where the movement of the pointer along a specific path matters". [Understanding 2.5.1](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)

Expert mode selects by recognizing the stroke's shape ([src/engine/machine.ts:695](../../src/engine/machine.ts)), which makes it a path-based gesture. Novice mode also depends on direction: the active item is the child nearest the pointer's azimuth ([src/engine/machine.ts:462-466](../../src/engine/machine.ts)). Choosing a command does not require a path, so the gesture is not essential. The library offers no single-pointer alternative, since `pointerTarget` is internal and adds no click selection ([src/layout/menu.ts:624-653](../../src/layout/menu.ts)).

Does an equivalent control elsewhere on the page satisfy it? Because the criterion is about functionality, not a specific control, yes. The Understanding examples are separate controls (plus/minus buttons for zoom, previous/next buttons for a carousel). The 2.5.1 document does not say "a different component" outright; 2.5.7's document does (below), and the two criteria are written in parallel. **Inference, high confidence.** The host path must not itself depend on a path-based gesture.

## 2.5.2 Pointer Cancellation: pass

At least one of these must hold: no down-event, abort or undo, up reversal, or essential. Under abort or undo, "Completion of the function is on the up-event, and a mechanism is available to abort the function before completion or to undo the function after completion". Moving back and releasing where you started is an acceptable abort for drag-and-drop. [Understanding 2.5.2](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)

Verified in the code:

- Down only emits `start`, never a selection ([src/engine/pointer-source.ts:43-52](../../src/engine/pointer-source.ts), [src/engine/machine.ts:565-567](../../src/engine/machine.ts)).
- `select` fires only on `pointerup` ([src/engine/pointer-source.ts:62-72](../../src/engine/pointer-source.ts), [src/engine/machine.ts:675-706](../../src/engine/machine.ts), [src/engine/machine.ts:358-363](../../src/engine/machine.ts)). `pointercancel` never selects ([src/engine/machine.ts:713](../../src/engine/machine.ts)).
- Abort, novice mode: releasing inside the dead zone (default radius 40px) leaves no active item, so the gesture is canceled ([src/engine/machine.ts:466](../../src/engine/machine.ts), [src/engine/machine.ts:691](../../src/engine/machine.ts)). This is the "go back where you started and release" abort.
- Abort, expert mode: pausing opens novice mode on the recognized submenu, or cancels outright when there is none ([src/engine/machine.ts:435-460](../../src/engine/machine.ts)). The dead-zone abort is then available. Releasing a stroke with no valid shape also cancels.

The host can add undo on top, but the library already meets the criterion.

## 2.5.7 Dragging Movements: fail for the library, host path meets it

Normative text: "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging, unless dragging is essential". A dragging movement is "a pointer interaction where the pointer is moved while activated". The Understanding document says: "It does not have to be the same component, so long as the functionality is equivalent." It adds that an action involving both dragging and a path-based gesture "may fail against the requirements of both success criteria". [Understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) [WCAG 2.2 §2.5.7](https://www.w3.org/TR/WCAG22/#dragging-movements)

Every selection is press, move and release, which is a dragging movement. The library has no non-dragging way to select. **Verified:** a host-provided equivalent command path meets 2.5.7, per the "same component" sentence above.

## 2.1.1 Keyboard (not asked, but relevant): fail for the library, host path meets it

2.1.1 exempts functions whose "underlying function requires input that depends on the path of the user's movement and not just the endpoints", such as freehand drawing. Functions achievable through discrete actions are not exempt. [Understanding 2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)

Choosing a command does not depend on the path, so the exception does not apply. The functionality must be keyboard-operable somewhere on the page. Keyboard access to the menu is out of scope per the map, so the host's command path has to be keyboard-operable as well as single-pointer. The README should say so. This criterion deserves an explicit mention in the host contract, since the map currently cites only 2.5.1 and 2.5.7.

## 4.1.2 Name, Role, Value: fail

For all user interface components, including those generated by script, "the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set; and notification of changes to these items is available to user agents". [WCAG 2.2 §4.1.2](https://www.w3.org/TR/WCAG22/#name-role-value) [Understanding 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)

Verified in the code: the menu is plain `div`s in an open shadow root ([src/layout/menu.ts:134-136](../../src/layout/menu.ts), [src/layout/menu.ts:215-258](../../src/layout/menu.ts)). There is no `role` and no `aria-*` anywhere in `src/`. The active item is shown only by toggling the `active` class ([src/layout/menu.ts:612](../../src/layout/menu.ts)). The label text reaches the accessibility tree as generic text, but role, active state and changes to it are not exposed. The stroke and indicator SVGs have no semantics. As decorative graphics they do not need any, but they are not marked hidden either.

This is the library's job. A host path cannot fix the component's own semantics.

## 4.1.3 Status Messages: not applicable to the library

A status message is "a change in content that is not a change of context" giving the result of an action, a waiting state, progress, or errors. The criterion does not require status messages. It only governs how they are exposed when present. The Understanding document excludes content shown when a user interacts with a component, "for example expanding components such as a menu", because "all components that meet the definition of a user interface component already have requirements specified under 4.1.2". [Understanding 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

- The library emits no text today, so it has no status messages to fail.
- The active item changing during novice mode is a state change of a component, so it falls under 4.1.2, not 4.1.3. **Inference from the quote above:** exposing it through roles and states fits WCAG more directly than a live region. This bears on the map's open question of _how_ the label is spoken.
- The selection result ("Bold applied") is the result of an action. It is a status message when shown or spoken, and the host owns it through `select`.

## 1.4.1 Use of Color (not asked)

"Color is not used as the only visual means of conveying information". [WCAG 2.2 §1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color)

- Active item: pass. Besides the color change, the label turns `font-weight: bolder` ([src/layout/menu.css:392-394](../../src/layout/menu.css)).
- Selected vs. canceled feedback stroke: **uncertain, possible fail.** The only difference is color, `#000` vs. `#de6b52` ([src/layout/gesture-feedback.ts:64-71](../../src/layout/gesture-feedback.ts), [src/layout/menu.css:245-248](../../src/layout/menu.css)). Whether this fails depends on whether the host's `select` announcement counts as the non-color means. The announcement is not visual, so strictly it does not.

## Open questions surfaced

1. **2.1.1 Keyboard belongs in the host contract.** The host's equivalent command path must be keyboard-operable, not just usable with a single pointer.
2. **Canceled feedback is color-only (1.4.1).** Decide whether to add a non-color cue, such as a dash pattern or a different shape, or to document it as the host's concern.
3. **Indicator under reduced motion (2.3.3).** Replace the size growth with a non-motion progress cue, such as opacity or fill, when `prefers-reduced-motion: reduce` is set.
4. **Wedge contrast (1.4.11).** Confirm that wedges are not needed to identify items. Otherwise the default `#f2f2f2` wedge on a white page (1.12:1) fails.
5. **Decorative SVGs** (stroke, indicator, feedback) should probably be hidden from the accessibility tree once the menu gets semantics (4.1.2).
