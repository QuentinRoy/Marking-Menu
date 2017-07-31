# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
