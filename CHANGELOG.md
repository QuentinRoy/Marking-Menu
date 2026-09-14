# Changelog

All notable changes to this project will be documented in this file. Entries are generated from [Changesets](https://github.com/changesets/changesets) — see `.changeset/README.md` for how to add one.

## [0.10.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.10.0...v0.10.1) (2026-07-22)

### Minor Changes

- [#113](https://github.com/QuentinRoy/Marking-Menu/issues/113) [`f0a870d`](https://github.com/QuentinRoy/Marking-Menu/commit/f0a870d596f05c8ca6722fe68326f07860037708) - migrate GitHub Pages deployment to Actions and ESM demo
- [#112](https://github.com/QuentinRoy/Marking-Menu/issues/112) [`3723cf4`](https://github.com/QuentinRoy/Marking-Menu/commit/3723cf4a7988ed6966ea58af336ae99c4d3df9ba) - publish native ESM build alongside UMD

### Patch Changes

- [#115](https://github.com/QuentinRoy/Marking-Menu/issues/115) [`f0d9c95`](https://github.com/QuentinRoy/Marking-Menu/commit/f0d9c95501b9a8a0e340eee93a4a68e1ad4855dc) - scope Jest tests to source
- [#110](https://github.com/QuentinRoy/Marking-Menu/issues/110) [`f553c5a`](https://github.com/QuentinRoy/Marking-Menu/commit/f553c5a6aa902dca35f8c7f683bf07c67ed339e2) - use event timestamp for open notifications

## [0.10.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0...v0.10.0) (2022-04-08)

### Major Changes

- CSS is now bundled with JS and does not have to be imported separately.
- rxjs 6 is not supported anymore

### Minor Changes

- [`64c2656`](https://github.com/QuentinRoy/Marking-Menu/commit/64c2656a5836deae4823d8214faf48192ffc5073) - increase submenu opening delay
- [`41c386f`](https://github.com/QuentinRoy/Marking-Menu/commit/41c386fdc11b7e023c1fa44487e79396aa9f3381) - upgrade jest and rxjs

### Patch Changes

- [`4c57509`](https://github.com/QuentinRoy/Marking-Menu/commit/4c57509e20f6b5595e24b094ef0dfb473cf17c5a) - fix rxjs peer dep version
- [`cec3474`](https://github.com/QuentinRoy/Marking-Menu/commit/cec34747e2c175d28e4d3230503c59c80238d7ba) - remove scss, use css variables and bundle css with js export

## [0.9.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.1...v0.9.0) (2018-10-01)

### Minor Changes

- [#41](https://github.com/QuentinRoy/Marking-Menu/issues/41) [`81de0fb`](https://github.com/QuentinRoy/Marking-Menu/commit/81de0fb) - different feedback on cancel, closes [#32](https://github.com/QuentinRoy/Marking-Menu/issues/32)
- [#34](https://github.com/QuentinRoy/Marking-Menu/issues/34) [`51b3619`](https://github.com/QuentinRoy/Marking-Menu/commit/51b3619) - expert to novice transition

## [0.9.0-beta.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.0...v0.9.0-beta.1) (2018-09-26)

## [0.9.0-beta.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.2...v0.9.0-beta.0) (2018-08-24)

### Minor Changes

- [`750ecbe`](https://github.com/QuentinRoy/Marking-Menu/commit/750ecbe) - feedback on gestures upon selection, closes [#2](https://github.com/QuentinRoy/Marking-Menu/issues/2)
- [`b204857`](https://github.com/QuentinRoy/Marking-Menu/commit/b204857) - lower stroke shows pas movements under a menu

### Patch Changes

- [#26](https://github.com/QuentinRoy/Marking-Menu/issues/26) [`62360ad`](https://github.com/QuentinRoy/Marking-Menu/commit/62360ad) - fix strokeColor option

## [0.8.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.1...v0.8.2) (2018-06-29)

## [0.8.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0...v0.8.1) (2018-04-28)

### Patch Changes

- [`1c7d72c`](https://github.com/QuentinRoy/Marking-Menu/commit/1c7d72c) - fix rxjs peer dependency

## [0.8.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0-alpha.0...v0.8.0) (2018-04-28)

## [0.8.0-alpha.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.1...v0.8.0-alpha.0) (2018-04-28)

### Minor Changes

- [`7f79831`](https://github.com/QuentinRoy/Marking-Menu/commit/7f79831) - support for custom logger

### Patch Changes

- [`dbc7e56`](https://github.com/QuentinRoy/Marking-Menu/commit/dbc7e56) - fix broken css build due to differui/rollup-plugin-sass[#42](https://github.com/QuentinRoy/Marking-Menu/issues/42)
- [`149e26b`](https://github.com/QuentinRoy/Marking-Menu/commit/149e26b) - make sure dwelling does not emit the last events on completion
- [`2691aa5`](https://github.com/QuentinRoy/Marking-Menu/commit/2691aa5) - update to rxjs6

## [0.7.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.0...v0.7.1) (2017-08-02)

### Patch Changes

- [`3838cc4`](https://github.com/QuentinRoy/Marking-Menu/commit/3838cc4) - Fix inconsistent open notifications.

## [0.7.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.1...v0.7.0) (2017-08-02)

### Major Changes

- [`e683d0f`](https://github.com/QuentinRoy/Marking-Menu/commit/e683d0f) - Rename notifications' `center` property to `menuCenter`.

### Minor Changes

- [`3547121`](https://github.com/QuentinRoy/Marking-Menu/commit/3547121) - Export timestamp with notifications.

## [0.6.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.0...v0.6.1) (2017-08-01)

### Patch Changes

- [`79fbf2f`](https://github.com/QuentinRoy/Marking-Menu/commit/79fbf2f) - Fix sub-menus positioning.

## [0.6.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.3...v0.6.0) (2017-08-01)

### Minor Changes

- [`8529971`](https://github.com/QuentinRoy/Marking-Menu/commit/8529971) - Addition of the notifySteps options.

### Patch Changes

- [`91fc285`](https://github.com/QuentinRoy/Marking-Menu/commit/91fc285) - Fix duplication of the first stroke notification.
- [`a9ace25`](https://github.com/QuentinRoy/Marking-Menu/commit/a9ace25) - Fix menu open notification(s)
- [`b9a76eb`](https://github.com/QuentinRoy/Marking-Menu/commit/b9a76eb) - Fix navigation start argument not being properly took into account.
- [`ec46e68`](https://github.com/QuentinRoy/Marking-Menu/commit/ec46e68) - Fix various inconsistent type of notification.
- [`c988723`](https://github.com/QuentinRoy/Marking-Menu/commit/c988723) - Protect the model against mutations.

## [0.5.3](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.2...v0.5.3) (2017-07-31)

### Patch Changes

- [`19b9fd3`](https://github.com/QuentinRoy/Marking-Menu/commit/19b9fd3) - Fix crash on tap/click., closes [#1](https://github.com/QuentinRoy/Marking-Menu/issues/1)

## [0.5.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.1...v0.5.2) (2017-07-29)

### Patch Changes

- [`bbffb8c`](https://github.com/QuentinRoy/Marking-Menu/commit/bbffb8c) - Fix DOM not being properly cleaned upon un-subscription of the observable.

## [0.5.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.0...v0.5.1) (2017-07-28)

### Patch Changes

- [`f5e6ca1`](https://github.com/QuentinRoy/Marking-Menu/commit/f5e6ca1) - Fix stroke shimmering on safari.

## [0.5.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.4.0...v0.5.0) (2017-07-28)

### Major Changes

- [`cd486ad`](https://github.com/QuentinRoy/Marking-Menu/commit/cd486ad) - Marking Menu's observable must now be subscribed to be effective and will be disabled once unsubscribed.

### Minor Changes

- [`89e2b27`](https://github.com/QuentinRoy/Marking-Menu/commit/89e2b27) - Draw stroke.

### Patch Changes

- [`dc86b34`](https://github.com/QuentinRoy/Marking-Menu/commit/dc86b34) - Fix the beginning of expert strokes being lost.
- [`c4cbc9f`](https://github.com/QuentinRoy/Marking-Menu/commit/c4cbc9f) - Make sure the stroke is cleared upon completion.

## [0.4.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.3.0...v0.4.0) (2017-07-28)

### Minor Changes

- [`048b439`](https://github.com/QuentinRoy/Marking-Menu/commit/048b439) - Expert / novice navigation mode switching.
- [`7cb9f96`](https://github.com/QuentinRoy/Marking-Menu/commit/7cb9f96) - Gesture recognizer.

## [0.3.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.2.0...v0.3.0) (2017-07-22)

### Minor Changes

- [`c96cc70`](https://github.com/QuentinRoy/Marking-Menu/commit/c96cc70) - **menu:** Change menu design.
- [`5ddeef0`](https://github.com/QuentinRoy/Marking-Menu/commit/5ddeef0) - Change menu radius.

### Patch Changes

- [`0235558`](https://github.com/QuentinRoy/Marking-Menu/commit/0235558) - Fix not working movements threshold.
- [`6233adc`](https://github.com/QuentinRoy/Marking-Menu/commit/6233adc) - Fix the whole observables chain being subscribed twice.
- [`8a10ae1`](https://github.com/QuentinRoy/Marking-Menu/commit/8a10ae1) - Prevent default drag behavior.

## [0.2.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.1...v0.2.0) (2017-07-21)

### Major Changes

- [`f93aa91`](https://github.com/QuentinRoy/Marking-Menu/commit/f93aa91) - Selection notifications do not directly gives the name of the selected item anymore but the corresponding model item.

### Minor Changes

- [`94bea34`](https://github.com/QuentinRoy/Marking-Menu/commit/94bea34) - **engine:** Introduce a minimum distance from the center to trigger a selection.
- [`2895f30`](https://github.com/QuentinRoy/Marking-Menu/commit/2895f30) - **model:** Support for children of items.
- [`3679393`](https://github.com/QuentinRoy/Marking-Menu/commit/3679393) - Support for multi-level marking menus.

## [0.1.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.0...v0.1.1) (2017-07-20)

### Patch Changes

- [`d1f50da`](https://github.com/QuentinRoy/Marking-Menu/commit/d1f50da) - Fix missing distributed files.

## 0.1.0 (2017-07-20)

### Minor Changes

- [`5aa198a`](https://github.com/QuentinRoy/Marking-Menu/commit/5aa198a) - **menu:** Make the root document configurable.
- [`e285594`](https://github.com/QuentinRoy/Marking-Menu/commit/e285594) - **menu:** Set active item by nearest angle.
- [`ff529f2`](https://github.com/QuentinRoy/Marking-Menu/commit/ff529f2) - Selection notifications.
- [`39a04f1`](https://github.com/QuentinRoy/Marking-Menu/commit/39a04f1) - Engine supporting 1-level Marking Menu.
- [`02f0b69`](https://github.com/QuentinRoy/Marking-Menu/commit/02f0b69) - Menu Layout.
