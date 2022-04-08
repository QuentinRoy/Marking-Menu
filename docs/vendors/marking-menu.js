/*!
 * Marking Menu Javascript Library v0.9.0
 * https://github.com/QuentinRoy/Marking-Menu
 *
 * Released under the MIT license.
 * https://raw.githubusercontent.com/QuentinRoy/Marking-Menu/master/LICENSE
 *
 * Marking Menus may be patented independently from this software.
 *
 * Date: Fri, 08 Apr 2022 08:35:31 GMT
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('rxjs/operators'), require('rxjs')) :
  typeof define === 'function' && define.amd ? define(['rxjs/operators', 'rxjs'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.MarkingMenu = factory(global.rxjs.operators, global.rxjs));
})(this, (function (operators, rxjs) { 'use strict';

  /**
   * @param {number} a the dividend
   * @param {number} n the divisor
   * @return {number} The modulo of `a` over `n` (% is not exactly modulo but remainder).
   */
  const mod = (a, n) => (a % n + n) % n;
  /**
   * @param {number} radians an angle in radians
   * @return {number} The angle in degrees.
   */

  const radiansToDegrees = radians => radians * (180 / Math.PI);
  /**
   * @param {number} alpha a first angle (in degrees)
   * @param {number} beta a second angle (in degrees)
   * @return {number} The (signed) delta between the two angles (in degrees).
   */

  const deltaAngle = (alpha, beta) => mod(beta - alpha + 180, 360) - 180;
  /**
   * Calculate the euclidean distance between two
   * points.
   *
   * @param {List<number>} point1 - The first point
   * @param {List<number>} point2 - The second point
   * @return {number} The distance between the two points.
   */

  const dist = (point1, point2) => {
    const sum = point1.reduce((acc, x1i, i) => {
      const x2i = point2[i];
      return acc + (x2i - x1i) ** 2;
    }, 0);
    return Math.sqrt(sum);
  };
  const ANGLE_ROUNDING = 10e-8;
  /**
   * @param {number[]} a - The first point.
   * @param {number[]} b - The second point, center of the angle.
   * @param {number[]} c - The third point.
   * @return {number} The angle abc (in degrees) rounded at the 8th decimal.
   */

  const angle = (a, b, c) => {
    const lab = dist(a, b);
    const lbc = dist(b, c);
    const lac = dist(a, c);
    const cos = (lab ** 2 + lbc ** 2 - lac ** 2) / (2 * lab * lbc); // Due to rounding, it can happen than cos ends up being slight > 1 or slightly < -1.
    // This fixes it.

    const adjustedCos = Math.max(-1, Math.min(1, cos));
    const angleABC = radiansToDegrees(Math.acos(adjustedCos)); // Round the angle to avoid rounding issues.

    return Math.round(angleABC / ANGLE_ROUNDING) * ANGLE_ROUNDING;
  };
  /**
   * @callback findMaxEntryComp
   * @param {*} item1 - A first item.
   * @param {*} item2 - A second item.
   * @return {number} A positive number if the second item should be ranked higher than the first,
   *                  a negative number if it should be ranked lower and 0 if they should be ranked
   *                  the same.
   */

  /**
   * @param {List} list - A list of items.
   * @param {findMaxEntryComp} comp - A function to calculate a value from an item.
   * @return {[index, item]} The found entry.
   */

  const findMaxEntry = (list, comp) => list.slice(0).reduce((result, item, index) => {
    if (comp(result[1], item) > 1) return [index, item];
    return result;
  }, [0, list[0]]);
  /**
   * Converts the coordinates of a point in polar coordinates (angle in degrees).
   *
   * @param  {number[]} point - A point.
   * @param  {number[]} [pole=[0, 0]] - The pole of a polar coordinate
   *                                    system
   * @return {{azymuth, radius}} The angle coordinate of the point in the polar
   *                             coordinate system in degrees.
   */

  const toPolar = function (_ref, _temp) {
    let [px, py] = _ref;
    let [cx, cy] = _temp === void 0 ? [0, 0] : _temp;
    const x = px - cx;
    const y = py - cy;
    return {
      azymuth: radiansToDegrees(Math.atan2(y, x)),
      radius: Math.sqrt(x * x + y * y)
    };
  };

  // Create a custom pointer event from a touch event.
  const createPEventFromTouchEvent = touchEvt => {
    const touchList = Array.from(touchEvt.targetTouches);
    const sumX = touchList.reduce((acc, t) => acc + t.clientX, 0);
    const sumY = touchList.reduce((acc, t) => acc + t.clientY, 0);
    const meanX = sumX / touchList.length;
    const meanY = sumY / touchList.length;
    return {
      originalEvent: touchEvt,
      position: [meanX, meanY],
      timeStamp: touchEvt.timeStamp
    };
  }; // Create a custom pointer from a mouse event.

  const createPEventFromMouseEvent = mouseEvt => ({
    originalEvent: mouseEvt,
    position: [mouseEvt.clientX, mouseEvt.clientY],
    timeStamp: mouseEvt.timeStamp
  });

  const mouseDrags = rootDOM => rxjs.fromEvent(rootDOM, 'mousedown').pipe(operators.map(downEvt => {
    // Make sure we include the first mouse down event.
    const drag$ = rxjs.merge(rxjs.of(downEvt), rxjs.fromEvent(rootDOM, 'mousemove')).pipe(operators.takeUntil(rxjs.fromEvent(rootDOM, 'mouseup')), // Publish it as a behavior so that any new subscription will
    // get the last drag position.
    operators.publishBehavior());
    drag$.connect();
    return drag$;
  }), operators.map(o => o.pipe(operators.map(function () {
    return createPEventFromMouseEvent(...arguments);
  })))); // Higher order observable tracking touch drags.

  const touchDrags = rootDOM => rxjs.fromEvent(rootDOM, 'touchstart').pipe( // Menu is supposed to have pointer-events: none so we can safely rely on
  // targetTouches.
  operators.filter(evt => evt.targetTouches.length === 1), operators.map(firstEvent => {
    const drag$ = rxjs.fromEvent(rootDOM, 'touchmove').pipe(operators.startWith(firstEvent), operators.takeUntil(rxjs.merge(rxjs.fromEvent(rootDOM, 'touchend'), rxjs.fromEvent(rootDOM, 'touchcancel'), rxjs.fromEvent(rootDOM, 'touchstart')).pipe(operators.filter(evt => evt.targetTouches.length !== 1))), operators.publishBehavior()); // FIXME: the line below retains the subscription until next touch end.

    drag$.connect();
    return drag$;
  }), operators.map(o => o.pipe(operators.map(createPEventFromTouchEvent))));
  /**
   * @param {HTMLElement} rootDOM - the DOM element to observe pointer events on.
   * @return {Observable} A higher order observable that drag observables. The sub-observables are
   *                      published as behaviors so that any new subscription immediately get the last
   *                      position.
   * @param {function[]} [dragObsFactories] - factory to use to observe drags.
   */

  const watchDrags = function (rootDOM, dragObsFactories) {
    if (dragObsFactories === void 0) {
      dragObsFactories = [touchDrags, mouseDrags];
    }

    return rxjs.merge(...dragObsFactories.map(f => f(rootDOM)));
  };

  /**
   * Filter out small movements out of a drag observable.
   * @param {Observable} drag$ - An observable on drag movements.
   * @param {number} movementsThreshold - The threshold below which movements are considered
   *                                      static.
   * @return {Observable} An observable only emitting on long enough movements.
   */

  var longMoves = (function (drag$, movementsThreshold) {
    if (movementsThreshold === void 0) {
      movementsThreshold = 0;
    }

    return drag$.pipe(operators.scan((_ref, cur) => {
      let [prev] = _ref;
      // Initial value.
      if (prev == null) return [cur, false]; // End of drag can never be a long move. Such events aren't supposed to be
      // emitted by drag observable though.

      if (cur.type === 'end' || cur.type === 'cancel') return [cur, false]; // If the distance is still below the threshold, re-emit the previous
      // event. It will be filtered-out later, but will come back again as
      // prev on the next scan call.

      if (dist(prev.position, cur.position) < movementsThreshold) return [prev, false]; // Otherwise, emit the new event.

      return [cur, true];
    }, []), operators.filter(_ref2 => {
      let [, pass] = _ref2;
      return pass;
    }), operators.map(x => x[0]));
  });

  /**
   * @param {Observable} drag$ - An observable on drag movements.
   * @param {number} delay - The time (in ms) to wait before considering an absence of movements
   *                         as a dwell.
   * @param {number} [movementsThreshold=0] - The threshold below which movements are considered
   *                                          static.
   * @param {Scheduler} [scheduler] - The scheduler to use for managing the timers that handle the timeout
   * for each value
   * @return {Observable} An observable on dwellings in the movement.
   */

  var dwellings = (function (drag$, delay, movementsThreshold, scheduler) {
    if (movementsThreshold === void 0) {
      movementsThreshold = 0;
    }

    if (scheduler === void 0) {
      scheduler = undefined;
    }

    return rxjs.merge(drag$.pipe(operators.first()), longMoves(drag$, movementsThreshold)).pipe( // Emit when no long movements happend for delay time.
    operators.debounceTime(delay, scheduler), // debounceTime emits the last item when the source observable completes.
    // We don't want that here so we only take until drag is done.
    operators.takeUntil(drag$.pipe(operators.last())), // Make sure we do emit the last position.
    operators.withLatestFrom(drag$, (_, last_) => last_));
  });

  /**
   * Augment a drag$ observable so that events also include the stroke.
   * @param {Observable} drag$ - An observable of drag movements.
   * @param {List<number[]>} initStroke - Initial stroke.
   * @return {Observable} An observable on the gesture drawing.
   */

  var draw = ((drag$, _ref) => {
    let {
      initStroke = [],
      type = undefined
    } = _ref;
    const typeOpts = type === undefined ? {} : {
      type
    };
    return drag$.pipe(operators.scan((acc, notification) => ({
      stroke: [...acc.stroke, notification.position],
      ...typeOpts,
      ...notification
    }), {
      stroke: initStroke
    }));
  });

  const noviceMoves = (drag$, menu, _ref) => {
    let {
      menuCenter,
      minSelectionDist
    } = _ref;
    // Analyse local movements.
    const moves$ = drag$.pipe(operators.scan((last_, n) => {
      const {
        azymuth,
        radius
      } = toPolar(n.position, menuCenter);
      const active = radius < minSelectionDist ? null : menu.getNearestChild(azymuth);
      const type = last_.active === active ? 'move' : 'change';
      return {
        active,
        type,
        azymuth,
        radius,
        ...n
      };
    }, {
      active: null
    }), operators.startWith({
      type: 'open',
      menu,
      center: menuCenter,
      timeStamp: performance ? performance.now() : Date.now()
    }), operators.share());
    const end$ = moves$.pipe(operators.startWith({}), operators.last(), operators.map(n => ({ ...n,
      type: n.active && n.active.isLeaf() ? 'select' : 'cancel',
      selection: n.active
    })));
    return rxjs.merge(moves$, end$).pipe(operators.share());
  };
  const menuSelection = (move$, _ref2) => {
    let {
      subMenuOpeningDelay,
      movementsThreshold,
      minMenuSelectionDist
    } = _ref2;
    return (// Wait for a pause in the movements.
      dwellings(move$, subMenuOpeningDelay, movementsThreshold).pipe( // Filter dwellings occurring outside of the selection area.
      operators.filter(n => n.active && n.radius > minMenuSelectionDist && !n.active.isLeaf()))
    );
  };
  const subMenuNavigation = (menuSelection$, drag$, subNav, navOptions) => menuSelection$.pipe(operators.map(n => subNav(drag$, n.active, {
    menuCenter: n.position,
    ...navOptions
  })));
  /**
   * @param {Observable} drag$ - An observable of drag movements.
   * @param {MMItem} menu - The model of the menu.
   * @param {object} options - Configuration options.
   * @return {Observable} An observable on the menu navigation events.
   */

  const noviceNavigation = (drag$, menu, _ref3) => {
    let {
      minSelectionDist,
      minMenuSelectionDist,
      movementsThreshold,
      subMenuOpeningDelay,
      menuCenter,
      noviceMoves: noviceMoves_ = noviceMoves,
      menuSelection: menuSelection_ = menuSelection,
      subMenuNavigation: subMenuNavigation_ = subMenuNavigation
    } = _ref3;
    // Observe the local navigation.
    const move$ = noviceMoves_(drag$, menu, {
      menuCenter,
      minSelectionDist
    }).pipe(operators.share()); // Look for (sub)menu selection.

    const menuSelection$ = menuSelection_(move$, {
      subMenuOpeningDelay,
      movementsThreshold,
      minMenuSelectionDist
    }); // Higher order observable on navigation inside sub-menus.

    const subMenuNavigation$ = subMenuNavigation_(menuSelection$, drag$, noviceNavigation, {
      minSelectionDist,
      minMenuSelectionDist,
      movementsThreshold,
      subMenuOpeningDelay,
      noviceMoves: noviceMoves_,
      menuSelection: menuSelection_,
      subMenuNavigation: subMenuNavigation_
    }); // Start with local navigation but switch to the first sub-menu navigation
    // (if any).

    return subMenuNavigation$.pipe(operators.take(1), operators.startWith(move$), operators.switchAll());
  };

  /**
   * @param {Array.<number[]>} pointList - The list of points.
   * @param {number} minDist - A distance.
   * @param {object} options - Options.
   * @param {number} [options.direction=1] - The direction of the lookup: negative values means
   *                                         descending lookup.
   * @param {number} [options.startIndex] - The index of the first point to investigate inside
   *                                        pointList. If not provided, the lookup will start
   *                                        from the start or the end of pointList depending
   *                                        on `direction`.
   * @param {number[]} [options.refPoint=pointList[startIndex]] - The reference point.
   * @return {number} The index of the first point inside pointList that it at least `minDist` from
   *                  `refPoint`.
   */

  const findNextPointFurtherThan = function (pointList, minDist, _temp) {
    let {
      direction = 1,
      startIndex = direction > 0 ? 0 : pointList.length - 1,
      refPoint = pointList[startIndex]
    } = _temp === void 0 ? {} : _temp;
    const step = direction / Math.abs(direction);
    const n = pointList.length;

    for (let i = startIndex; i < n && i >= 0; i += step) {
      if (dist(refPoint, pointList[i]) >= minDist) {
        return i;
      }
    }

    return -1;
  };
  /**
   * @param {number[]} pointA - The point a.
   * @param {number[]} pointC - The point b.
   * @param {List.<number[]>} pointList - A list of points.
   * @param {number[]} options - Options.
   * @param {number} [options.startIndex=0] - The index of the first point to investigate inside
   *                                          pointList.
   * @param {number} [options.endIndex=pointList.length - 1] - The index of the first point to
   *                                                           investigate inside pointList.
   * @return {{index, angle}} The index of the point b of pointList that maximizes the angle abc and
   *                          the angle abc.
   */

  const findMiddlePointForMinAngle = function (pointA, pointC, pointList, _temp2) {
    let {
      startIndex = 0,
      endIndex = pointList.length - 1
    } = _temp2 === void 0 ? {} : _temp2;
    let minAngle = Infinity;
    let maxAngleIndex = -1;

    for (let i = startIndex; i <= endIndex; i += 1) {
      const thisAngle = angle(pointA, pointList[i], pointC);

      if (thisAngle < minAngle) {
        minAngle = thisAngle;
        maxAngleIndex = i;
      }
    }

    return {
      index: maxAngleIndex,
      angle: minAngle
    };
  };

  /**
   * @typedef {number[]} Point
   */

  /**
   * A segment.
   * @typedef {Point[2]} Segment
   */

  /**
   * @param {Point[]} stroke - The points of a stroke.
   * @param {number} expectedSegmentLength - The expected length of a segment
   *                                         (usually strokeLength / maxMenuDepth).
   * @param {number} angleThreshold - The min angle threshold in a point required for it to be
   *                                  considered an articulation points.
   * @return {Point[]} The list of articulation points.
   */

  const getStrokeArticulationPoints = (stroke, expectedSegmentLength, angleThreshold) => {
    const n = stroke.length;
    if (n === 0) return [];
    const w = expectedSegmentLength * 0.3; // Add the first point of the stroke.

    const articulationPoints = [stroke[0]];
    let ai = 0;
    let a = stroke[ai];

    while (ai < n) {
      const ci = findNextPointFurtherThan(stroke, w, {
        startIndex: ai + 2,
        refPoint: a
      });
      if (ci < 0) break;
      const c = stroke[ci];
      const labi = findNextPointFurtherThan(stroke, w / 8, {
        startIndex: ai + 1,
        refPoint: a
      });
      const lbci = findNextPointFurtherThan(stroke, w / 8, {
        startIndex: ci - 1,
        refPoint: c,
        direction: -1
      });
      const {
        index: bi,
        angle: angleABC
      } = findMiddlePointForMinAngle(a, stroke[ci], stroke, {
        startIndex: labi,
        endIndex: lbci
      });

      if (bi > 0 && Math.abs(180 - angleABC) > angleThreshold) {
        const b = stroke[bi];
        articulationPoints.push(b);
        a = b;
        ai = bi;
      } else {
        ai += 1;
        a = stroke[ai];
      }
    } // Add the last point of the stroke.


    articulationPoints.push(stroke[stroke.length - 1]);
    return articulationPoints;
  };

  /**
   * @param {List<List<number>>} stroke - A stroke.
   * @return {number} The length of the stroke `stroke`.
   */

  var strokeLength = (stroke => stroke.reduce((res, current) => {
    const prev = res.prev || current;
    return {
      prev: current,
      length: res.length + dist(prev, current)
    };
  }, {
    length: 0
  }).length);

  /**
   * @param {Point[]} points - A list of points.
   * @return {Segment[]} The list of segments joining the points of `points`.
   */

  const pointsToSegments = points => points.slice(1).reduce((_ref, current) => {
    let {
      segments,
      last
    } = _ref;
    segments.push([last, current]);
    return {
      segments,
      last: current
    };
  }, {
    last: points[0],
    segments: []
  }).segments;
  /**
   * @param {Item} model - The marking menu model.
   * @param {{ angle }[]} segments - A list of segments to walk the model.
   * @param {number} [startIndex=0] - The start index in the angle list.
   * @return {Item} The corresponding item found by walking the model.
   */

  const walkMMModel = function (model, segments, startIndex) {
    if (startIndex === void 0) {
      startIndex = 0;
    }

    if (!model || segments.length === 0 || model.isLeaf()) return null;
    const item = model.getNearestChild(segments[startIndex].angle);

    if (startIndex + 1 >= segments.length) {
      return item;
    }

    return walkMMModel(item, segments, startIndex + 1);
  };
  const segmentAngle = (a, b) => radiansToDegrees(Math.atan2(b[1] - a[1], b[0] - a[0]));
  /**
   * @param {{angle, length}[]} segments - A list of segments.
   * @return {{angle, length}[]} A new list of segments with the longest segments divided in two.
   */

  const divideLongestSegment = segments => {
    const [longestI, longest] = findMaxEntry(segments, (s1, s2) => s2.length - s1.length);
    return [...segments.slice(0, longestI), {
      length: longest.length / 2,
      angle: longest.angle
    }, {
      length: longest.length / 2,
      angle: longest.angle
    }, ...segments.slice(longestI + 1)];
  };
  /**
   * @param {Item} model - The marking menu model.
   * @param {{length, angle}[]} segments - A list of segments.
   * @param {number} [maxDepth=model.getMaxDepth()] - The maximum depth of the item.
   * @return {Item} The selected item.
   */

  const findMMItem = function (model, segments, maxDepth) {
    if (maxDepth === void 0) {
      maxDepth = model.getMaxDepth();
    }

    // If there is not segments, there is no selection to find.
    if (!segments.length) return null; // While we haven't found a leaf item, divide the longest segment and walk the model.

    let currentSegments = segments;
    let currentItem = null;

    while (currentSegments.length <= maxDepth) {
      currentItem = walkMMModel(model, currentSegments);
      if (currentItem && currentItem.isLeaf()) return currentItem;
      currentSegments = divideLongestSegment(currentSegments);
    }

    return currentItem;
  };
  /**
   * @param {List.<number[]>} stroke - A list of points.
   * @param {Item} model - The marking menu model.
   * @param {object} [options] - Additional options.
   * @param {number} [maxDepth] - The maximum menu depth to walk. If negative,
   * start from the maximum depth of the model.
   * @param {boolean} [requireMenu=false] - Look for a menu item. This
   * works best with a negative value for maxDepth.
   * @param {boolean} [requireLeaf=!requireMenu] - Look for a leaf.
   * @return {Item} The item recognized by the stroke.
   */

  const recognizeMMStroke = function (stroke, model, _temp) {
    let {
      maxDepth: maxDepth_ = model.getMaxDepth(),
      requireMenu = false,
      requireLeaf = !requireMenu
    } = _temp === void 0 ? {} : _temp;

    if (requireLeaf && requireMenu) {
      throw new Error('The result cannot be both a leaf and a menu');
    }

    const maxDepth = maxDepth_ < 0 ? model.getMaxDepth() + maxDepth_ : maxDepth_;
    const maxMenuBreadth = model.getMaxBreadth();
    const length = strokeLength(stroke);
    const expectedSegmentLength = length / maxDepth;
    const sensitivity = 0.75;
    const angleThreshold = 360 / maxMenuBreadth / 2 / sensitivity;
    const articulationPoints = getStrokeArticulationPoints(stroke, expectedSegmentLength, angleThreshold);
    const minSegmentSize = expectedSegmentLength / 3; // Get the segments of the marking menus.

    const segments = pointsToSegments(articulationPoints) // Change the representation of the segment to include its length.
    .map(seg => ({
      points: seg,
      length: dist(...seg)
    })) // Remove the segments that are too small.
    .filter(seg => seg.length > minSegmentSize) // Change again the representation of the segment to include its length but not its
    // its points anymore.
    .map(seg => ({
      angle: segmentAngle(...seg.points),
      length: seg.length
    }));
    const item = findMMItem(model, segments, maxDepth);

    if (requireLeaf) {
      return item && item.isLeaf() ? item : null;
    }

    if (requireMenu) {
      return item && item.isLeaf() ? item.parent : item;
    }

    return item;
  };

  /**
   * @param {Observable} drag$ - An observable of drag movements.
   * @param {MMItem} model - The model of the menu.
   * @param {List<number[]>} initStroke - Initial stroke.
   * @return {Observable} An observable on the gesture drawing and recognition.
   */

  var expertNavigation = (function (drag$, model, initStroke) {
    if (initStroke === void 0) {
      initStroke = [];
    }

    // Observable on gesture drawing.
    const draw$ = draw(drag$, {
      initStroke,
      type: 'draw'
    }).pipe(operators.share()); // Track the end of the drawing and attempt to recognize the gesture.

    const end$ = draw$.pipe(operators.startWith(null), operators.last(), operators.map(e => {
      if (!e) return {
        type: 'cancel'
      };
      const selection = recognizeMMStroke(e.stroke, model);

      if (selection) {
        return { ...e,
          type: 'select',
          selection
        };
      }

      return { ...e,
        type: 'cancel'
      };
    }));
    return rxjs.merge(draw$, end$);
  });

  const confirmedNoviceNavigationHOO = (drag$, start, model, options) => dwellings(drag$, options.noviceDwellingTime, options.movementsThreshold).pipe(operators.take(1), operators.map(() => (start != null ? rxjs.of(start) : drag$).pipe(operators.take(1), operators.mergeMap(start_ => noviceNavigation( // Same as before, skip the first.
  drag$.pipe(operators.skip(1)), model, { ...options,
    menuCenter: start_.position
  }).pipe(operators.map(n => ({ ...n,
    mode: 'novice'
  })))))));
  const expertToNoviceSwitchHOO = (drag$, model, initStroke, options) => dwellings(draw(drag$, {
    initStroke
  }), options.noviceDwellingTime, options.movementsThreshold).pipe(operators.take(1), operators.map(evt => {
    // Look for the furthest menu (not leaf).
    const menu = recognizeMMStroke(evt.stroke, model, {
      maxDepth: -1,
      requireMenu: true
    });

    if (!menu || menu.isRoot()) {
      return rxjs.of({ ...evt,
        type: 'cancel'
      });
    } // Start a novice navigation from there.


    return noviceNavigation(drag$.pipe(operators.skip(1)), menu, { ...options,
      menuCenter: evt.position
    });
  }));
  const confirmedExpertNavigationHOO = function (drag$, model, _temp) {
    let {
      expertToNoviceSwitchHOO: expertToNoviceSwitchHOO_ = expertToNoviceSwitchHOO,
      ...options
    } = _temp === void 0 ? {} : _temp;
    return longMoves(draw(drag$, {
      type: 'draw'
    }), options.movementsThreshold).pipe(operators.take(1), operators.map(e => {
      const expertNav$ = expertNavigation( // Drag always return the last value when observed, in this case we are
      // not interested in it as it has already been took into account.
      drag$.pipe(operators.skip(1)), model, e.stroke).pipe(operators.map(n => ({ ...n,
        mode: 'expert'
      })));
      return expertToNoviceSwitchHOO_(drag$, model, e.stroke, options).pipe(operators.startWith(expertNav$), operators.switchAll());
    }));
  };
  const startup = (drag$, model) => expertNavigation(drag$, model).pipe(operators.map((n, i) => i === 0 ? { ...n,
    type: 'start',
    mode: 'startup'
  } : { ...n,
    mode: 'startup'
  }));
  const navigationFromDrag = function (drag$, start, model, options, _temp2) {
    let {
      confirmedExpertNavigationHOO: confirmedExpertNavigationHOO_ = confirmedExpertNavigationHOO,
      confirmedNoviceNavigationHOO: confirmedNoviceNavigationHOO_ = confirmedNoviceNavigationHOO,
      startup: startup_ = startup
    } = _temp2 === void 0 ? {} : _temp2;
    // Start up observable (while neither expert or novice are confirmed).
    const startUp$ = startup_(drag$, model); // Observable on confirmed expert navigation.

    const confirmedExpertNavigation$$ = confirmedExpertNavigationHOO_(drag$, model, options); // Observable on confirmed novice navigation.

    const confirmedNoviceNavigation$$ = confirmedNoviceNavigationHOO_(drag$, start, model, options); // Observable on expert or novice navigation once confirmed.

    const confirmedNavigation$$ = rxjs.race(confirmedExpertNavigation$$, confirmedNoviceNavigation$$); // Start with startup navigation (similar to expert) but switch to the
    // confirmed navigation as soon as it is settled.

    return confirmedNavigation$$.pipe(operators.startWith(startUp$), operators.switchAll());
  };
  /**
   * @param {Observable} drags$ - A higher order observable on drag movements.
   * @param {MMItem} menu - The model of the menu.
   * @param {object} options - Configuration options (see {@link ../index.js}).
   * @param {function} [navigationFromDrag_] - function to convert a drags higher
   *                                         order observable to a navigation
   *                                         observable.
   * @return {Observable} An observable on the marking menu events.
   */

  var navigation = (function (drags$, menu, options, navigationFromDrag_) {
    if (navigationFromDrag_ === void 0) {
      navigationFromDrag_ = navigationFromDrag;
    }

    return drags$.pipe(operators.exhaustMap(drag$ => drag$.pipe(operators.take(1), operators.mergeMap(start => navigationFromDrag_(drag$, start, menu, options)))));
  });

  const template = (_ref, doc) => {
    let {
      items,
      center
    } = _ref;
    const main = doc.createElement('div');
    main.className = 'marking-menu';
    main.style.left = `${center[0]}px`;
    main.style.top = `${center[1]}px`;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const elt = doc.createElement('div');
      elt.className = 'marking-menu-item';
      elt.dataset.itemId = item.id;
      elt.dataset.itemAngle = item.angle;
      elt.innerHTML += '<div class="marking-menu-line"></div>';
      elt.innerHTML += `<div class="marking-menu-label">${item.name}</div>`;
      main.appendChild(elt);
    }

    return main;
  };
  /**
   * Create the Menu display.
   * @param {HTMLElement} parent - The parent node.
   * @param {ItemModel} model - The model of the menu to open.
   * @param {[int, int]} center - The center of the menu.
   * @param {String} [current] - The currently active item.
   * @param {Document} [options] - Menu options.
   * @param {Document} [options.doc=document] - The root document of the menu.
   *                                            Mostly useful for testing purposes.
   * @return {{ setActive, remove }} - The menu controls.
   */


  const createMenu = function (parent, model, center, current, _temp) {
    let {
      doc = document
    } = _temp === void 0 ? {} : _temp;
    // Create the DOM.
    const main = template({
      items: model.children,
      center
    }, doc);
    parent.appendChild(main); // Clear any  active items.

    const clearActiveItems = () => {
      Array.from(main.querySelectorAll('.active')).forEach(itemDom => itemDom.classList.remove('active'));
    }; // Return an item DOM element from its id.


    const getItemDom = itemId => main.querySelector(`.marking-menu-item[data-item-id="${itemId}"]`); // Mark an item as active.


    const setActive = itemId => {
      // Clear any  active items.
      clearActiveItems(); // Set the active class.

      if (itemId || itemId === 0) {
        getItemDom(itemId).classList.add('active');
      }
    }; // Function to remove the menu.


    const remove = () => parent.removeChild(main); // Initialize the menu.


    if (current) setActive(current); // Create the interface.

    return {
      setActive,
      remove
    };
  };

  /**
   * @param {HTMLElement} parent - The parent node.
   * @param {Document} options - Options.
   * @param {Document} [options.doc=document] - The root document. Mostly useful for testing purposes.
   * @param {number} [options.lineWidth=2] - The width of the stroke.
   * @param {string} [options.lineColor='black'] - CSS representation of the stroke color.
   * @param {number} [options.startPointRadius=0] - The radius of the start point.
   * @param {number} [options.startPointColor=options.lineColor] - CSS representation of the start
   *                                                               point color.
   * @param {number} [options.ptSize=1 / devicePixelRatio] - The size of the canvas points
   *                                                         (px).
   * @return {{ clear, setStroke, remove }} The canvas methods.
   */
  var createStrokeCanvas = ((parent, _ref) => {
    let {
      doc = document,
      lineWidth = 2,
      lineColor = 'black',
      pointRadius = 0,
      pointColor = lineColor,
      ptSize = window.devicePixelRatio ? 1 / window.devicePixelRatio : 1
    } = _ref;
    // Create the canvas.
    const {
      width,
      height
    } = parent.getBoundingClientRect();
    const canvas = doc.createElement('canvas');
    canvas.width = width / ptSize;
    canvas.height = height / ptSize;
    Object.assign(canvas.style, {
      position: 'absolute',
      left: 0,
      top: 0,
      width: `${width}px`,
      height: `${height}px`,
      'pointer-events': 'none'
    });
    parent.appendChild(canvas); // Get the canvas' context and set it up

    const ctx = canvas.getContext('2d'); // Scale to the device pixel ratio.

    ctx.scale(1 / ptSize, 1 / ptSize);
    /**
     * @param {number[]} point - Position of the point to draw.
     * @return {undefined}
     */

    const drawPoint = _ref2 => {
      let [x, y] = _ref2;
      ctx.save();
      ctx.strokeStyle = 'none';
      ctx.fillStyle = pointColor;
      ctx.beginPath();
      ctx.moveTo(x + pointRadius, y);
      ctx.arc(x, y, pointRadius, 0, 360);
      ctx.fill();
      ctx.restore();
    };
    /**
     * Clear the canvas.
     *
     * @return {undefined}
     */


    const clear = () => {
      ctx.clearRect(0, 0, width, height);
    };
    /**
     * Draw the stroke.
     *
     * @param {List<number[]>} stroke - The new stroke.
     * @return {undefined}
     */


    const drawStroke = stroke => {
      ctx.save();
      ctx.fillStyle = 'none';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      stroke.forEach((point, i) => {
        if (i === 0) ctx.moveTo(...point);else ctx.lineTo(...point);
      });
      ctx.stroke();
      ctx.restore();
    };
    /**
     * Destroy the canvas.
     * @return {undefined}
     */


    const remove = () => {
      canvas.remove();
    };

    return {
      clear,
      drawStroke,
      drawPoint,
      remove
    };
  });

  var rafSchd = function rafSchd(fn) {
    var lastArgs = [];
    var frameId = null;

    var wrapperFn = function wrapperFn() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      lastArgs = args;

      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(function () {
        frameId = null;
        fn.apply(void 0, lastArgs);
      });
    };

    wrapperFn.cancel = function () {
      if (!frameId) {
        return;
      }

      cancelAnimationFrame(frameId);
      frameId = null;
    };

    return wrapperFn;
  };

  var rafThrottle = rafSchd;

  /**
   * Connect navigation notifications to menu opening and closing.
   *
   * @param {HTMLElement} parentDOM - The element where to append the menu.
   * @param {Observable} navigation$ - Notifications of the navigation.
   * @param {Function} createMenuLayout - Menu layout factory.
   * @param {Function} createUpperStrokeCanvas - Upper stroke canvas factory. The
   * upper stroke show the user interaction on the current menu, and the movements
   * in expert mode.
   * @param {Function} createLowerStrokeCanvas - Lower stroke canvas factory. The
   * lower stroke is stroke drawn below the menu. It keeps track of the previous
   * movements.
   * @param {Function} createGestureFeedback - Create gesture feedback.
   * @param {{error}} log - Logger.
   * @return {Observable} `navigation$` with menu opening and closing side effects.
   */

  var connectLayout = ((parentDOM, navigation$, createMenuLayout, createUpperStrokeCanvas, createLowerStrokeCanvas, createGestureFeedback, log) => {
    // The menu object.
    let menu = null; // A stroke drawn on top of the menu.

    let upperStrokeCanvas = null; // A stroke drawn below the menu.

    let lowerStrokeCanvas = null; // The points of the lower strokes.

    let lowerStroke = null; // The points of the upper stroke.

    let upperStroke = null;
    const gestureFeedback = createGestureFeedback(parentDOM);

    const closeMenu = () => {
      menu.remove();
      menu = null;
    };

    const openMenu = (model, position) => {
      const cbr = parentDOM.getBoundingClientRect();
      menu = createMenuLayout(parentDOM, model, [position[0] - cbr.left, position[1] - cbr.top]);
    };

    const setActive = id => {
      menu.setActive(id);
    };

    const startUpperStroke = position => {
      upperStrokeCanvas = createUpperStrokeCanvas(parentDOM);
      upperStroke = [position];
      upperStrokeCanvas.drawStroke(upperStroke);
    };

    const noviceMove = rafThrottle(position => {
      if (upperStrokeCanvas) {
        upperStrokeCanvas.clear();

        if (position) {
          upperStroke = [upperStroke[0], position];
          upperStrokeCanvas.drawStroke(upperStroke);
        }

        upperStrokeCanvas.drawPoint(upperStroke[0]);
      }
    });
    const expertDraw = rafThrottle(stroke => {
      // FIXME: Not very efficient.
      if (upperStrokeCanvas) {
        upperStrokeCanvas.clear();
        upperStroke = stroke.slice();
        upperStrokeCanvas.drawStroke(upperStroke);
      }
    });

    const clearUpperStroke = () => {
      upperStrokeCanvas.remove();
      upperStrokeCanvas = null;
      upperStroke = null;
    };

    const swapUpperStroke = () => {
      lowerStroke = lowerStroke ? [...lowerStroke, ...upperStroke] : upperStroke;
      clearUpperStroke();
      lowerStrokeCanvas = lowerStrokeCanvas || createLowerStrokeCanvas(parentDOM);
      lowerStrokeCanvas.drawStroke(lowerStroke);
    };

    const clearLowerStroke = () => {
      if (lowerStrokeCanvas) {
        lowerStrokeCanvas.remove();
        lowerStrokeCanvas = null;
      }

      lowerStroke = null;
    };

    const showGestureFeedback = isCanceled => {
      gestureFeedback.show(lowerStroke ? [...lowerStroke, ...upperStroke] : upperStroke, isCanceled);
    };

    const cleanUp = () => {
      // Make sure everything is cleaned upon completion.
      if (menu) closeMenu();
      if (upperStrokeCanvas) clearUpperStroke();
      if (lowerStrokeCanvas) clearLowerStroke();
      gestureFeedback.remove(); // eslint-disable-next-line no-param-reassign

      parentDOM.style.cursor = '';
    };

    const onNotification = notification => {
      switch (notification.type) {
        case 'open':
          {
            // eslint-disable-next-line no-param-reassign
            parentDOM.style.cursor = 'none';
            if (menu) closeMenu();
            swapUpperStroke();
            openMenu(notification.menu, notification.center);
            startUpperStroke(notification.center);
            noviceMove(notification.position);
            break;
          }

        case 'change':
          {
            setActive(notification.active && notification.active.id || null);
            break;
          }

        case 'select':
        case 'cancel':
          // eslint-disable-next-line no-param-reassign
          parentDOM.style.cursor = '';
          if (menu) closeMenu();
          showGestureFeedback(notification.type === 'cancel');
          clearUpperStroke();
          clearLowerStroke();
          break;

        case 'start':
          // eslint-disable-next-line no-param-reassign
          parentDOM.style.cursor = 'crosshair';
          startUpperStroke(notification.position);
          break;

        case 'draw':
          expertDraw(notification.stroke);
          break;

        case 'move':
          noviceMove(notification.position);
          break;

        default:
          throw new Error(`Invalid navigation notification type: ${notification.type}`);
      }
    };

    return navigation$.pipe(operators.tap({
      next(notification) {
        try {
          onNotification(notification);
        } catch (e) {
          log.error(e);
          throw e;
        }
      },

      error(e) {
        log.error(e);
        throw e;
      }

    }), operators.finalize(() => {
      try {
        cleanUp();
      } catch (e) {
        log.error(e);
        throw e;
      }
    }));
  });

  var createGestureFeedback = ((parentDOM, _ref) => {
    let {
      duration,
      strokeOptions = {},
      canceledStrokeOptions = {}
    } = _ref;
    let strokeTimeoutEntries = [];

    const show = function (stroke, isCanceled) {
      if (isCanceled === void 0) {
        isCanceled = false;
      }

      const canvas = createStrokeCanvas(parentDOM, { ...strokeOptions,
        ...(isCanceled ? canceledStrokeOptions : {})
      });
      canvas.drawStroke(stroke);
      const timeoutEntry = {
        canvas,
        timeout: setTimeout(() => {
          // Remove the entry from the strokeTimeoutEntries.
          strokeTimeoutEntries = strokeTimeoutEntries.filter(x => x !== timeoutEntry); // Clear the stroke canvas.

          canvas.remove();
        }, duration)
      };
      strokeTimeoutEntries.push(timeoutEntry);
    };

    const remove = () => {
      strokeTimeoutEntries.forEach(_ref2 => {
        let {
          timeout,
          canvas
        } = _ref2;
        clearTimeout(timeout);
        canvas.remove();
      });
      strokeTimeoutEntries = [];
    };

    return {
      show,
      remove
    };
  });

  const getAngleRange = items => items.length > 4 ? 45 : 90;
  /**
   * Represents an item of the Marking Menu.
   */


  class MMItem {
    /**
     * @param {String} id - The item's id. Required except for the root item.
     * @param {String} name - The item's name. Required except for the root item.
     * @param {Integer} angle - The item's angle. Required except for the root item.
     * @param {object} [options] - Some additional options.
     * @param {ItemModel} [options.parent] - The parent menu of the item.
     * @param {List<ItemModel>} [options.children] - The children of the item menu.
     */
    constructor(id, name, angle, _temp) {
      let {
        parent,
        children
      } = _temp === void 0 ? {} : _temp;
      this.id = id;
      this.name = name;
      this.angle = angle;
      this.children = children;
      this.parent = parent;
    }

    isLeaf() {
      return !this.children || this.children.length === 0;
    }

    isRoot() {
      return !this.parent;
    }
    /**
     * @param {String} childId - The identifier of the child to look for.
     * @return {Item} the children with the id `childId`.
     */


    getChild(childId) {
      return this.children.find(child => child.id === childId);
    }
    /**
     * @param {String} childName - The name of the children to look for.
     * @return {Item} the children with the name `childName`.
     */


    getChildrenByName(childName) {
      return this.children.filter(child => child.name === childName);
    }
    /**
     * @param {Integer} angle - An angle.
     * @return {Item} the closest children to the angle `angle`.
     */


    getNearestChild(angle) {
      return this.children.reduce((c1, c2) => {
        const delta1 = Math.abs(deltaAngle(c1.angle, angle));
        const delta2 = Math.abs(deltaAngle(c2.angle, angle));
        return delta1 > delta2 ? c2 : c1;
      });
    }
    /**
     * @return {number} The maximum depth of the menu.
     */


    getMaxDepth() {
      return this.isLeaf() ? 0 : Math.max(0, ...this.children.map(child => child.getMaxDepth())) + 1;
    }
    /**
     * @return {number} The maximum breadth of the menu.
     */


    getMaxBreadth() {
      return this.isLeaf() ? 0 : Math.max(this.children.length, ...this.children.map(child => child.getMaxBreadth()));
    }

  } // Create the model item from a list of items.

  const recursivelyCreateModelItems = function (items, baseId, parent) {
    if (baseId === void 0) {
      baseId = undefined;
    }

    if (parent === void 0) {
      parent = undefined;
    }

    // Calculate the angle range for each items.
    const angleRange = getAngleRange(items); // Create the list of model items (frozen).

    return Object.freeze(items.map((item, i) => {
      // Standard item id.
      const stdId = baseId ? [baseId, i].join('-') : i.toString(); // Create the item.

      const mmItem = new MMItem(item.id == null ? stdId : item.id, typeof item === 'string' ? item : item.name, i * angleRange, {
        parent
      }); // Add its children if any.

      if (item.children) {
        mmItem.children = recursivelyCreateModelItems(item.children, stdId, mmItem);
      } // Return it frozen.


      return Object.freeze(mmItem);
    }));
  };
  /**
   * Create the marking menu model.
   *
   * @param {List<String|{name,children}>} itemList - The list of items.
   * @return {MMItem} - The root item of the model.
   */


  const createModel = itemList => {
    const menu = new MMItem(null, null, null);
    menu.children = recursivelyCreateModelItems(itemList, undefined, menu);
    return Object.freeze(menu);
  };

  const exportNotification = n => ({
    type: n.type,
    mode: n.mode,
    position: n.position ? n.position.slice() : undefined,
    active: n.active,
    selection: n.selection,
    menuCenter: n.center ? n.center.slice() : undefined,
    timeStamp: n.timeStamp
  });
  /**
   * Create a Marking Menu.
   *
   * @param {List<String|{name,children}>} items - The list of items.
   * @param {HTMLElement} parentDOM - The parent node.
   * @param {Object} [options] - Configuration options for the menu.
   * @param {number} [options.minSelectionDist] - The minimum distance from the center to select an
   *                                              item.
   * @param {number} [options.minMenuSelectionDist] - The minimum distance from the center to open a
   *                                                  sub-menu.
   * @param {number} [options.subMenuOpeningDelay] - The dwelling delay before opening a sub-menu.
   * @param {number} [options.movementsThreshold] - The minimum distance between two points to be
   *                                                considered a significant movements and breaking
   *                                                the sub-menu dwelling delay.
   * @param {number} [options.noviceDwellingTime] - The dwelling time required to trigger the novice
   *                                                mode (and open the menu).
   * @param {number} [options.strokeColor] - The color of the gesture stroke.
   * @param {number} [options.strokeWidth] - The width of the gesture stroke.
   * @param {number} [options.strokeStartPointRadius] - The radius of the start point of the stroke
   *                                                    (appearing at the middle of the menu in novice
   *                                                    mode).
   * @param {number} [options.lowerStrokeColor] - The color of the lower stroke. The lower stroke is
   *                                              the stroke drawn below the menu. It keeps track of
   *                                              the previous movements.
   * @param {number} [options.lowerStrokeWidth] - The width of the lower stroke.
   * @param {number} [options.lowerStrokeStartPointRadius] - The radius of the start point of the
   *                                                         stroke.
   * @param {number} [options.gestureFeedbackStrokeWidth] - The width of the stroke of the gesture
   *                                                        feedback.
   * @param {number} [options.gestureFeedbackStrokeColor] - The color of the stroke of the gesture
   *                                                        feedback.
   * @param {number} [options.gestureFeedbackCanceledStrokeColor] - The color of the stroke of the
   *                                                        gesture feedback when the selection is
   *                                                        canceled.
   * @param {number} [options.gestureFeedbackDuration] - The duration of the gesture feedback.
   * @param {boolean} [options.notifySteps] - If true, every steps of the marking menu (include move)
   *                                          events, will be notified. Useful for logging.
   * @param {{error, info, warn, debug}} [options.log] - Override the default logger to use.
   * @return {Observable} An observable on menu selections.
   */

  var MarkingMenu = (function (items, parentDOM, _temp) {
    let {
      minSelectionDist = 40,
      minMenuSelectionDist = 80,
      subMenuOpeningDelay = 25,
      movementsThreshold = 5,
      noviceDwellingTime = 1000 / 3,
      strokeColor = '#000',
      strokeWidth = 4,
      strokeStartPointRadius = 8,
      lowerStrokeColor = '#777',
      lowerStrokeWidth = strokeWidth,
      lowerStrokeStartPointRadius = lowerStrokeWidth,
      gestureFeedbackDuration = 1000,
      gestureFeedbackStrokeWidth = strokeWidth,
      gestureFeedbackCanceledStrokeColor = '#DE6C52',
      gestureFeedbackStrokeColor = strokeColor,
      notifySteps = false,
      log = {
        // eslint-disable-next-line no-console
        error: console.error && console.error.bind(console),
        // eslint-disable-next-line no-console
        info: console.info && console.info.bind(console),
        // eslint-disable-next-line no-console
        warn: console.warn && console.warn.bind(console),

        debug() {}

      }
    } = _temp === void 0 ? {} : _temp;
    // Create the display options
    const menuLayoutOptions = {};
    const strokeCanvasOptions = {
      lineColor: strokeColor,
      lineWidth: strokeWidth,
      pointRadius: strokeStartPointRadius
    };
    const lowerStrokeCanvasOptions = {
      lineColor: lowerStrokeColor,
      lineWidth: lowerStrokeWidth,
      pointRadius: lowerStrokeStartPointRadius
    };
    const gestureFeedbackOptions = {
      duration: gestureFeedbackDuration,
      strokeOptions: {
        lineColor: gestureFeedbackStrokeColor,
        lineWidth: gestureFeedbackStrokeWidth
      },
      canceledStrokeOptions: {
        lineColor: gestureFeedbackCanceledStrokeColor
      }
    }; // Create model and navigation observable.

    const model = createModel(items);
    const navigation$ = navigation(watchDrags(parentDOM), model, {
      minSelectionDist,
      minMenuSelectionDist,
      subMenuOpeningDelay,
      movementsThreshold,
      noviceDwellingTime
    }).pipe(operators.tap(_ref => {
      let {
        originalEvent
      } = _ref;
      // Prevent default on every notifications.
      if (originalEvent) originalEvent.preventDefault();
    })); // Connect the engine's notifications to menu opening/closing.

    const connectedNavigation$ = connectLayout(parentDOM, navigation$, (parent, menuModel, center, current) => createMenu(parent, menuModel, center, current, menuLayoutOptions), parent => createStrokeCanvas(parent, strokeCanvasOptions), parent => createStrokeCanvas(parent, lowerStrokeCanvasOptions), parent => createGestureFeedback(parent, gestureFeedbackOptions), log); // If every steps should be notified, just export connectedNavigation$.

    if (notifySteps) {
      return connectedNavigation$.pipe(operators.map(exportNotification), operators.share());
    } // Else, return an observable on the selections.


    return connectedNavigation$.pipe(operators.filter(notification => notification.type === 'select'), operators.pluck('selection'), operators.share());
  });

  return MarkingMenu;

}));
//# sourceMappingURL=marking-menu.js.map
