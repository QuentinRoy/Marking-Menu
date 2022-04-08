# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.10.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0...v0.10.0) (2022-04-08)


### ⚠ BREAKING CHANGES

* CSS is now bundled with JS and does not have to be imported separately.
* rxjs 6 is not supported anymore

### Features

* increase submenu opening delay ([64c2656](https://github.com/QuentinRoy/Marking-Menu/commit/64c2656a5836deae4823d8214faf48192ffc5073))
* upgrade jest and rxjs ([41c386f](https://github.com/QuentinRoy/Marking-Menu/commit/41c386fdc11b7e023c1fa44487e79396aa9f3381))


### Bug Fixes

* fix rxjs peer dep version ([4c57509](https://github.com/QuentinRoy/Marking-Menu/commit/4c57509e20f6b5595e24b094ef0dfb473cf17c5a))


* remove scss, use css variables and bundle css with js export ([cec3474](https://github.com/QuentinRoy/Marking-Menu/commit/cec34747e2c175d28e4d3230503c59c80238d7ba))

<a name="0.9.0"></a>
# [0.9.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.1...v0.9.0) (2018-10-01)


### Features

* different feedback on cancel ([#41](https://github.com/QuentinRoy/Marking-Menu/issues/41)) ([81de0fb](https://github.com/QuentinRoy/Marking-Menu/commit/81de0fb)), closes [#32](https://github.com/QuentinRoy/Marking-Menu/issues/32)
* expert to novice transition ([#34](https://github.com/QuentinRoy/Marking-Menu/issues/34)) ([51b3619](https://github.com/QuentinRoy/Marking-Menu/commit/51b3619))



<a name="0.9.0-beta.1"></a>
# [0.9.0-beta.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.9.0-beta.0...v0.9.0-beta.1) (2018-09-26)



<a name="0.9.0-beta.0"></a>
# [0.9.0-beta.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.2...v0.9.0-beta.0) (2018-08-24)


### Bug Fixes

* fix strokeColor option ([#26](https://github.com/QuentinRoy/Marking-Menu/issues/26)) ([62360ad](https://github.com/QuentinRoy/Marking-Menu/commit/62360ad))


### Features

* feedback on gestures upon selection ([750ecbe](https://github.com/QuentinRoy/Marking-Menu/commit/750ecbe)), closes [#2](https://github.com/QuentinRoy/Marking-Menu/issues/2)
* lower stroke shows pas movements under a menu ([b204857](https://github.com/QuentinRoy/Marking-Menu/commit/b204857))



<a name="0.8.2"></a>
## [0.8.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.1...v0.8.2) (2018-06-29)



<a name="0.8.1"></a>
## [0.8.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0...v0.8.1) (2018-04-28)


### Bug Fixes

* fix rxjs peer dependency ([1c7d72c](https://github.com/QuentinRoy/Marking-Menu/commit/1c7d72c))



<a name="0.8.0"></a>
# [0.8.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.8.0-alpha.0...v0.8.0) (2018-04-28)



<a name="0.8.0-alpha.0"></a>
# [0.8.0-alpha.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.1...v0.8.0-alpha.0) (2018-04-28)


### Bug Fixes

* fix broken css build due to differui/rollup-plugin-sass[#42](https://github.com/QuentinRoy/Marking-Menu/issues/42) ([dbc7e56](https://github.com/QuentinRoy/Marking-Menu/commit/dbc7e56))
* make sure dwelling does not emit the last events on completion ([149e26b](https://github.com/QuentinRoy/Marking-Menu/commit/149e26b))
* update to rxjs6 ([2691aa5](https://github.com/QuentinRoy/Marking-Menu/commit/2691aa5))


### Features

* support for custom logger ([7f79831](https://github.com/QuentinRoy/Marking-Menu/commit/7f79831))



<a name="0.7.1"></a>
## [0.7.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.7.0...v0.7.1) (2017-08-02)


### Bug Fixes

* Fix inconsistent open notifications. ([3838cc4](https://github.com/QuentinRoy/Marking-Menu/commit/3838cc4))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.1...v0.7.0) (2017-08-02)


### Features

* Export timestamp with notifications. ([3547121](https://github.com/QuentinRoy/Marking-Menu/commit/3547121))
* Rename notifications' `center` property to `menuCenter`. ([e683d0f](https://github.com/QuentinRoy/Marking-Menu/commit/e683d0f))


### BREAKING CHANGES

* Rename notifications' `center` property to `menuCenter`.



<a name="0.6.1"></a>
## [0.6.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.6.0...v0.6.1) (2017-08-01)


### Bug Fixes

* Fix sub-menus positioning. ([79fbf2f](https://github.com/QuentinRoy/Marking-Menu/commit/79fbf2f))



<a name="0.6.0"></a>
# [0.6.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.3...v0.6.0) (2017-08-01)


### Bug Fixes

* Fix duplication of the first stroke notification. ([91fc285](https://github.com/QuentinRoy/Marking-Menu/commit/91fc285))
* Fix menu open notification(s) ([a9ace25](https://github.com/QuentinRoy/Marking-Menu/commit/a9ace25))
* Fix navigation start argument not being properly took into account. ([b9a76eb](https://github.com/QuentinRoy/Marking-Menu/commit/b9a76eb))
* Fix various inconsistent type of notification. ([ec46e68](https://github.com/QuentinRoy/Marking-Menu/commit/ec46e68))
* Protect the model against mutations. ([c988723](https://github.com/QuentinRoy/Marking-Menu/commit/c988723))


### Features

* Addition of the notifySteps options. ([8529971](https://github.com/QuentinRoy/Marking-Menu/commit/8529971))



<a name="0.5.3"></a>
## [0.5.3](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.2...v0.5.3) (2017-07-31)


### Bug Fixes

* Fix crash on tap/click. ([19b9fd3](https://github.com/QuentinRoy/Marking-Menu/commit/19b9fd3)), closes [#1](https://github.com/QuentinRoy/Marking-Menu/issues/1)



<a name="0.5.2"></a>
## [0.5.2](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.1...v0.5.2) (2017-07-29)


### Bug Fixes

* Fix DOM not being properly cleaned upon un-subscription of the observable. ([bbffb8c](https://github.com/QuentinRoy/Marking-Menu/commit/bbffb8c))



<a name="0.5.1"></a>
## [0.5.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.5.0...v0.5.1) (2017-07-28)


### Bug Fixes

* Fix stroke shimmering on safari. ([f5e6ca1](https://github.com/QuentinRoy/Marking-Menu/commit/f5e6ca1))



<a name="0.5.0"></a>
# [0.5.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.4.0...v0.5.0) (2017-07-28)


### Bug Fixes

* Fix the beginning of expert strokes being lost. ([dc86b34](https://github.com/QuentinRoy/Marking-Menu/commit/dc86b34))
* Make sure the stroke is cleared upon completion. ([c4cbc9f](https://github.com/QuentinRoy/Marking-Menu/commit/c4cbc9f))


### Features

* Draw stroke. ([89e2b27](https://github.com/QuentinRoy/Marking-Menu/commit/89e2b27))
* Marking Menu's observable must now be subscribed to be effective. ([cd486ad](https://github.com/QuentinRoy/Marking-Menu/commit/cd486ad))


### BREAKING CHANGES

* Marking Menu's observable must now be subscribed to be effective and will be disabled once unsubscribed.



<a name="0.4.0"></a>
# [0.4.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.3.0...v0.4.0) (2017-07-28)


### Features

* Expert / novice navigation mode switching. ([048b439](https://github.com/QuentinRoy/Marking-Menu/commit/048b439))
* Gesture recognizer. ([7cb9f96](https://github.com/QuentinRoy/Marking-Menu/commit/7cb9f96))



<a name="0.3.0"></a>
# [0.3.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.2.0...v0.3.0) (2017-07-22)


### Bug Fixes

* Fix not working movements threshold. ([0235558](https://github.com/QuentinRoy/Marking-Menu/commit/0235558))
* Fix the whole observables chain being subscribed twice. ([6233adc](https://github.com/QuentinRoy/Marking-Menu/commit/6233adc))
* Prevent default drag behavior. ([8a10ae1](https://github.com/QuentinRoy/Marking-Menu/commit/8a10ae1))


### Features

* **menu:** Change menu design. ([c96cc70](https://github.com/QuentinRoy/Marking-Menu/commit/c96cc70))
* Change menu radius. ([5ddeef0](https://github.com/QuentinRoy/Marking-Menu/commit/5ddeef0))



<a name="0.2.0"></a>
# [0.2.0](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.1...v0.2.0) (2017-07-21)


### Features

* Selection notification now returns the item object. ([f93aa91](https://github.com/QuentinRoy/Marking-Menu/commit/f93aa91))
* **engine:** Introduce a minimum distance from the center to trigger a selection. ([94bea34](https://github.com/QuentinRoy/Marking-Menu/commit/94bea34))
* **model:** Support for children of items. ([2895f30](https://github.com/QuentinRoy/Marking-Menu/commit/2895f30))
* Support for multi-level marking menus. ([3679393](https://github.com/QuentinRoy/Marking-Menu/commit/3679393))


### BREAKING CHANGES

* Selection notifications do not directly gives the name of the selected item anymore but the corresponding model item.



<a name="0.1.1"></a>
## [0.1.1](https://github.com/QuentinRoy/Marking-Menu/compare/v0.1.0...v0.1.1) (2017-07-20)


### Bug Fixes

* Fix missing distributed files. ([d1f50da](https://github.com/QuentinRoy/Marking-Menu/commit/d1f50da))



<a name="0.1.0"></a>
# 0.1.0 (2017-07-20)


### Features

* **menu:** Make the root document configurable. ([5aa198a](https://github.com/QuentinRoy/Marking-Menu/commit/5aa198a))
* **menu:** Set active item by nearest angle. ([e285594](https://github.com/QuentinRoy/Marking-Menu/commit/e285594))
*  Selection notifications. ([ff529f2](https://github.com/QuentinRoy/Marking-Menu/commit/ff529f2))
* Engine supporting 1-level Marking Menu. ([39a04f1](https://github.com/QuentinRoy/Marking-Menu/commit/39a04f1))
* Menu Layout. ([02f0b69](https://github.com/QuentinRoy/Marking-Menu/commit/02f0b69))
