# Issue #350: Screen reader behavior for a transient, pointer-driven menu

Research for the [accessibility map](https://github.com/QuentinRoy/Marking-Menu/issues/349). Sources checked in September 2026.

## Summary

Screen readers speak a web widget through two channels: the focused object, and announcements (live regions, `ariaNotify()`). A menu that never takes focus reaches neither of the focus-based ones. All three engines ignore `aria-activedescendant` changes unless its owner has DOM focus, and a `role="menu"` subtree gets no menu events unless focus moves into it. Only an announcement can speak the active item while host focus stays put.

- **Focus on the active item** (`focus()` on a `menuitem` during the stroke) is the only path the specifications guarantee to be spoken. It steals host focus, so the library must restore it.
- **`ariaNotify()`** is specified (merged into WAI-ARIA in February 2026) and exposed in Chrome 141+, Firefox 150+, and Safari 27. Published tests show it spoken on Windows and Android. It was not spoken on iOS Safari 26.5, and Chrome notes that on macOS it is not reliably spoken. It needs no DOM and no focus.
- **Live regions** must already be registered before their content changes. NVDA queues polite updates without cancelling stale ones, so a fast stroke leaves a backlog.
- **Shadow DOM** does not hide content from the accessibility tree. ID references do not cross a shadow boundary: they resolve within the element's own root. Element reflection can point _outward_ (Chrome 135, Firefox 136, Safari 16.4). Reference Target can forward inward, but it has shipped only in Chrome 152.
- **Touch passthrough** exists on both mobile screen readers, but it is a modal, focus-anchored workaround, not direct touch. Neither VoiceOver nor TalkBack has a web equivalent of iOS's direct-interaction trait.

## 1. `role="menu"` / `menuitem` with and without focus

### Verified

- WAI-ARIA requires authors to manage focus on `menu` and `menubar` ("Authors MUST manage focus on the following container roles: … menu, menubar …"). The APG menu pattern places keyboard focus on an item when a menu opens; Tab does not move focus into it. [WAI-ARIA 1.2 §managed focus](https://www.w3.org/TR/wai-aria-1.2/#managingfocus) [APG Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- Core-AAM defines the platform menu events around focus: `EVENT_SYSTEM_MENUPOPUPSTART` / UIA `MenuOpenedEvent` / `AXMenuOpenedNotification` when the popup opens, then a focus event (`EVENT_OBJECT_FOCUS`, `AutomationFocusChangedEvent`, `AXMenuItemSelectedNotification`) on each item as it is focused. UIA's opened event is "then a focus event on a menuitem". The focus events belong to the focus move, not to the menu's appearance. [Core-AAM §3.8.5 Special Events for Menus](https://w3c.github.io/core-aam/#mapping_events_menus)
- Screen readers speak focus changes regardless of what caused them. NVDA's `event_gainFocus` calls `reportFocus()` → `speakObject(reason=FOCUS)`, and on `focusEntered` a menu, menubar, or menuitem cancels current speech. [NVDA `NVDAObjects/__init__.py`](https://github.com/nvaccess/nvda/blob/master/source/NVDAObjects/__init__.py)
- NVDA drops focus speech that is out of date: when focus has already moved on, its queued focus utterance is cancelled (`FocusLossCancellableSpeechCommand`). A fast sequence of `focus()` calls therefore collapses toward the latest item instead of queueing. [NVDA `eventHandler.py`](https://github.com/nvaccess/nvda/blob/master/source/eventHandler.py)
- Published keyboard test data (a11ysupport.io, APG actions menu button with `aria-activedescendant`, retested 2025-09-09 on desktop): when focus is in the menu, NVDA 2025.1 + Firefox 139 says "Action 1, 1 of 4, Actions, menu". NVDA + Chrome 137 says "Action 1, 1 of 4" without the menu role. VoiceOver macOS 15.5 + Safari 18.5 says "…menu popup button, You are currently on a menu item…". Older data: VoiceOver iOS 15 said "selected, action 1, menu item" and TalkBack 8.1 + Chrome 80 said "action 1, menu item, expanded, double tap to activate". All of these follow a keyboard or AT activation, not a pointer. [a11ysupport.io test data](https://github.com/accessibilitysupported/a11ysupport.io/blob/master/data/tests/apg/menu-button-actions-active-descendant.json)
- A menu shown with nothing focused sends no focus event, so a screen reader has nothing to speak. It is only reachable by virtual-cursor or explore-by-touch navigation, and a transient menu is gone before the user can navigate to it. This follows from the event tables above. No source documents a menu announcing itself on insertion without focus.
- Pointer-driven `focus()`: `element.focus({ preventScroll })` moves focus. Browsers decide heuristically whether to show a focus ring unless `focusVisible` is set. [HTML §focus management APIs](https://html.spec.whatwg.org/multipage/interaction.html#focus-management-apis)
- Removing the focused element runs the focus fixup rule. Focus goes to the viewport (`document.body`) and, on synchronous removal, no `blur` event fires. Nothing restores host focus automatically; the APG menu-button pattern has the author return focus to the invoker when the menu closes. [WHATWG HTML PR #8392](https://github.com/whatwg/html/pull/8392) [APG Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- The library currently cancels `pointerdown` and captures the pointer (`src/engine/pointer-source.ts`). Per Pointer Events, cancelling a primary `pointerdown` sets the PREVENT MOUSE EVENT flag, which suppresses the compatibility `mousedown`. [Pointer Events: `pointerdown` and compatibility mouse events](https://w3c.github.io/pointerevents/)

### Uncertain / needs a test

- **Latency** of a pointer-driven `focus()` reaching speech. No vendor documents it. Chromium batches accessibility events until the next lifecycle update, and the screen reader adds its own delay. Measure it in the manual checklist.
- **Whether the host's focus and caret survive.** Suppressing `mousedown` should keep the browser from moving focus on press, but no specification ties focus-on-press to `mousedown`, so verify it per engine. Once the library calls `focus()` on an item, host focus is lost. A text control keeps `selectionStart`/`selectionEnd` across blur, but `contenteditable` selection restore is not guaranteed. Save `document.activeElement` (shadow-including) at gesture start, restore it with `focus({ preventScroll: true })`, and test caret restoration.
- **VoiceOver macOS and TalkBack when a menuitem is focused by script during a pointer drag.** Whether the VO cursor or TalkBack's accessibility focus follows DOM focus while the user is not navigating is not documented by Apple or Google for web content.
- **NVDA mode switching.** When focus lands on a `menuitem`, NVDA may switch from browse mode to focus mode and play a sound, which may be noisy during a stroke.

## 2. `aria-activedescendant` without focus on its owner

**Verified: not spoken.** The specification assumes DOM focus stays on the container ("the user agent keeps the DOM focus on the container element or on an input element that controls the container element"). The APG says the attribute tells assistive technologies which element is active "when the container has DOM focus". [WAI-ARIA 1.2 `aria-activedescendant`](https://www.w3.org/TR/wai-aria-1.2/#aria-activedescendant) [APG: managing focus in composites](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_general_within)

All three engines ignore the change unless the owner is focused:

- Chromium `AXNodeObject::HandleActiveDescendantChanged` returns unless `GetDocument()->FocusedElement() == GetNode()`. [ax_node_object.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/accessibility/ax_node_object.cc)
- Gecko `DocAccessible::ARIAActiveDescendantChanged` moves the active item only if `IsActiveWidget()`, which requires DOM focus (or focus in a combobox's entry). [DocAccessible.cpp](https://github.com/mozilla-firefox/firefox/blob/main/accessible/generic/DocAccessible.cpp) [LocalAccessible.cpp](https://github.com/mozilla-firefox/firefox/blob/main/accessible/generic/LocalAccessible.cpp)
- WebKit `AXObjectCache::handleActiveDescendantChange`: "Notify active descendant changes only for the focused element." [AXObjectCache.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/accessibility/AXObjectCache.cpp)

`aria-activedescendant` is therefore only an option if the library focuses a container (the menu root, which steals host focus the same way as focusing items) and reflects the active item on it. On Android, Core-AAM's mapping for the attribute is still "TBD". [Core-AAM `aria-activedescendant`](https://w3c.github.io/core-aam/#ariaActiveDescendant)

## 3. Live regions: created with the menu vs persistent; `polite` against a fast stroke

### Verified

- AT "will only convey changes to a live region, not the initial contents". Polite updates are presented "at the next graceful opportunity", and assertive ones "SHOULD immediately notify". [WAI-ARIA `aria-live`](https://w3c.github.io/aria/#aria-live)
- MDN: establish the live region before updating it. If it is created from script, defer the content update to a later task; "the most reliable way … is to include them in the initial markup". `role="alert"` is the exception: most combinations announce it even when it is injected with its content, often with an "Alert" prefix. [MDN: ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- A region created with the menu is therefore unreliable for the first item unless the library waits at least one task. A region that persists for the lifetime of the menu instance (inside the shadow root, not only while the menu is shown) avoids this.
- NVDA on IAccessible2 (Firefox, Chrome) queues each live-region report as `speakText(priority=NORMAL)` for polite, or `NEXT` for assertive. [NVDA `NVDAHelper/__init__.py`](https://github.com/nvaccess/nvda/blob/master/source/NVDAHelper/__init__.py) `NORMAL` is plain queueing and `NEXT` plays "after the next utterance of lower priority is complete". Neither interrupts; only `NOW` interrupts. [NVDA `speech/priorities.py`](https://github.com/nvaccess/nvda/blob/master/source/speech/priorities.py) Unlike focus speech, NVDA does not cancel stale live-region utterances, so a stroke that crosses four items can queue four labels and finish speaking after the gesture ends.

### Uncertain

- VoiceOver (macOS, iOS) and TalkBack queueing and coalescing of rapid live-region changes are not documented by Apple or Google. Test them manually.
- Mitigations such as speaking only when the active item is stable for N ms, or replacing one region's text with `aria-atomic="true"`, are engineering choices, not documented AT behavior.

## 4. `ariaNotify()`

### Spec status (verified)

- Added to WAI-ARIA by [w3c/aria PR #2577](https://github.com/w3c/aria/pull/2577), merged 2026-02-11 (editor's draft). IDL: `ariaNotify(DOMString announcement, optional AriaNotificationOptions options)` on `Element` and `Document`, with `priority: "normal" | "high"` (default `"normal"`). The call aborts if the node is excluded from the accessibility tree or the `aria-notify` permissions policy blocks it (default allowlist `*`). [WAI-ARIA ED `ARIANotifyMixin`](https://w3c.github.io/aria/#ARIANotifyMixin)
- Core-AAM platform mappings: UIA `UiaRaiseNotificationEvent` (`ImportantAll` for high, `All` otherwise); ATK `notification` signal; AX API `NSAccessibilityAnnouncementRequestedNotification` with high/medium priority. MSAA + IAccessible2 has "no implementation specified". Where no API fits, the UA MAY synthesize a hidden live region. Language comes from the nearest `lang`. Android mapping is not specified. [Core-AAM §4.1.1 ariaNotify](https://w3c.github.io/core-aam/#arianotify)
- MDN: `normal` ≈ polite (after current speech), `high` ≈ assertive (interrupts). `aria-live` announcements take priority over `ariaNotify()`. Combine rapid announcements into one call. [MDN `Element.ariaNotify()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify)

### Browser support (verified from BCD; exposure ≠ speech)

| Browser                          | Version | Notes                                                                                                                                    |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome / Edge (desktop, Android) | 141     | Partial. "Fully supported on Windows and Linux, no support on ChromeOS"; on macOS "exposed … but notifications are not reliably spoken". |
| Firefox (desktop, Android)       | 150     |                                                                                                                                          |
| Safari (macOS, iOS)              | 27      | Added by BCD's Safari 27 beta collector run (Aug 2026). The Safari 27 beta announcement does not mention it.                             |

[MDN browser-compat-data `api/Element.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json)

### Screen reader results (published test, 2026-06-03, not a vendor source)

Spoken: NVDA 2026.1.1 with Firefox 151, Chrome 149, and Edge 148; TalkBack 16 with Chrome 148 and Firefox 151. Not spoken: VoiceOver iOS 26.5 with Safari 26.5 and Firefox. macOS VoiceOver, JAWS, and Narrator were not tested. [oidaisdes.org: ARIA Notify browser support](https://oidaisdes.org/blog/aria-notify-browser-support/)

### Uncertain

- Whether Safari 27 speaks it on macOS and iOS (released in the last weeks, with no test data yet).
- Whether `priority: "high"` interrupts the previous notification in NVDA and TalkBack, which a fast stroke needs so that superseded labels are cut.

## 5. Shadow DOM: ID references and accessibility tree exposure

### Verified

- **ID references resolve within the element's root.** For reflected element attributes, the HTML standard returns the first element whose "root is the same as element's root" with the given ID. An `aria-labelledby="x"` inside the menu's shadow root cannot name a host-document element, and vice versa. [HTML: reflecting element references](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes)
- **Element reflection can point outward, not inward.** An explicitly set element (e.g. `ariaActiveDescendantElement`, `ariaLabelledByElements`, `ariaControlsElements`) is honoured only if it "is a descendant of any of element's shadow-including ancestors". Shadow content can reference light DOM, but not the other way round. Support: Chrome 135, Firefox 136, Safari 16.4. [HTML ibid.](https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes) [BCD `api/Element.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json)
- **Reference Target** (`ShadowRoot.referenceTarget` / `shadowrootreferencetarget`) forwards ID references aimed at a host to an element inside its shadow root. It shipped in Chrome 152; Firefox 144 and Safari 26 have it only behind a preference. [Chrome 152 release notes](https://developer.chrome.com/release-notes/152) [DOM PR #1353](https://github.com/whatwg/dom/pull/1353) [BCD `api/ShadowRoot.json`](https://github.com/mdn/browser-compat-data/blob/main/api/ShadowRoot.json)
- **Exposure:** the accessibility tree follows the flat (composed) tree, so open _or_ closed shadow content is exposed like light DOM. Chromium's accessibility tree walks `LayoutTreeBuilderTraversal`/`FlatTreeTraversal`. [Chromium ax_object.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/accessibility/ax_object.cc) Shadow mode (`open`) affects script access only.
- **Focus in shadow DOM:** `document.activeElement` is retargeted to the host, and `shadowRoot.activeElement` gives the inner element. [HTML `DocumentOrShadowRoot.activeElement`](https://html.spec.whatwg.org/multipage/interaction.html#dom-documentorshadowroot-activeelement) The engines' "owner focused" checks in §2 compare the real focused element, not the retargeted host (read from the Chromium, Gecko, and WebKit sources). Keeping the owner and its active descendant in the same shadow root avoids any cross-root question.

### Consequence

A menu root and its items inside one shadow root can use content-attribute IDs freely. Linking to the host element (e.g. `aria-controls` from the host's trigger to the menu) requires element reflection from inside, or Reference Target (Chrome-only today).

## 6. Touch passthrough under VoiceOver and TalkBack

### Verified

- **VoiceOver iOS, "Use a standard gesture":** "Double-tap and hold your finger on the screen until you hear three rising tones, then make the gesture. When you lift your finger, VoiceOver gestures resume." The pass-through lasts one gesture. [Apple: Learn VoiceOver gestures on iPhone](https://support.apple.com/guide/iphone/learn-voiceover-gestures-iph3e2e2281/ios)
- **iOS direct touch** (`UIAccessibilityTraits.allowsDirectInteraction`: "allows direct touch interaction for VoiceOver users") exists only for native views. WAI-ARIA has no equivalent; [w3c/aria #1215](https://github.com/w3c/aria/issues/1215), "Need an attribute for direct interaction elements on a touch screen", has been open since 2020. [Apple `allowsDirectInteraction`](https://developer.apple.com/documentation/uikit/uiaccessibilitytraits/allowsdirectinteraction)
- **TalkBack double-tap and hold** ("Long press the focused item"). In AOSP `TouchExplorer.onDoubleTapAndHold` → `EventDispatcher.longPressWithTouchEvents`, then state `DELEGATING` ("The user can continue to move their finger around the screen to execute a drag."). The injected stream is **offset so it starts at the accessibility-focused item's click point** (or the last touch-explored point), not where the finger is: `mLongPressingPointerDeltaX/Y = finger − clickLocation`. [AOSP TouchExplorer.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/accessibility/java/com/android/server/accessibility/gestures/TouchExplorer.java) [AOSP EventDispatcher.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/accessibility/java/com/android/server/accessibility/gestures/EventDispatcher.java)
- **TalkBack pass-through gesture:** "the system interprets the next gesture like TalkBack is off", listed as a 4-finger double tap and hold (TalkBack 9.1+). [Google: TalkBack gestures](https://support.google.com/accessibility/android/answer/6151827)
- Two-finger drags are passed to the app as a one-pointer drag only when multi-finger gestures do not claim them (`isTwoFingerPassthroughEnabled`). Current TalkBack uses two-finger swipes for scrolling. [AOSP TouchExplorer.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/accessibility/java/com/android/server/accessibility/gestures/TouchExplorer.java)

So yes, a free-form single-finger stroke can be performed: double-tap and hold, then drag. With VoiceOver the user waits for three tones first. On TalkBack, the stroke is replayed from the focused element's centre.

### Uncertain / needs a test

- Whether iOS Safari delivers the VoiceOver pass-through touches to the page as ordinary `pointerdown`/`pointermove` at the finger's location, and after what hold delay.
- How the pass-through's own long-press hold interacts with the marking menu's press-and-wait: the system hold comes first, then the menu's novice delay, then the stroke.
- Whether focus or announcements from the page are spoken _while_ the finger is down in pass-through.
- How a blind user would know where a marking-menu surface is and which direction maps to which item without the novice menu being spoken.

## Implications for the map

- To speak the active item without taking focus, `ariaNotify()` is the only candidate. It is spoken on Windows and Android; on Apple platforms support is unproven. A persistent polite live region is the fallback, and on NVDA it lags behind a fast stroke.
- Moving focus onto `menuitem`s is the only path spoken by every engine and screen reader per the specifications, and NVDA cancels stale focus speech. It costs host focus, which the library must save and restore, and may trigger mode-switch noise.
- `aria-activedescendant` adds nothing over direct item focus: it also needs the menu to hold focus.
- Touch passthrough is possible but modal and awkward. It suits power users who already know a menu's layout, not discovery. This supports the map's "host owns the non-gesture path"; a README mention should describe the gesture as possible, not as the accessible path.
