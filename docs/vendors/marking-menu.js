/*!
 * Marking Menu Javascript Library v0.9.0
 * https://github.com/QuentinRoy/Marking-Menu
 *
 * Released under the MIT license.
 * https://raw.githubusercontent.com/QuentinRoy/Marking-Menu/master/LICENSE
 *
 * Marking Menus may be patented independently from this software.
 *
 * Date: Mon, 22 Mar 2021 16:20:41 GMT
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('rxjs/operators'), require('rxjs')) :
  typeof define === 'function' && define.amd ? define(['rxjs/operators', 'rxjs'], factory) :
  (global = global || self, global.MarkingMenu = factory(global.rxjs.operators, global.rxjs));
}(this, (function (operators, rxjs) { 'use strict';

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  function _objectWithoutPropertiesLoose(source, excluded) {
    if (source == null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key, i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  }

  var source = function (angleInRadians) {
      // angleInDegree = angleInRadians * (180 / Math.PI)  
      return angleInRadians * 57.29577951308232
  };

  /**
   * @param {number} a the dividend
   * @param {number} n the divisor
   * @return {number} The modulo of `a` over `n` (% is not exactly modulo but remainder).
   */

  var mod = function mod(a, n) {
    return (a % n + n) % n;
  };
  /**
   * @param {number} alpha a first angle (in degrees)
   * @param {number} beta a second angle (in degrees)
   * @return {number} The (signed) delta between the two angles (in degrees).
   */

  var deltaAngle = function deltaAngle(alpha, beta) {
    return mod(beta - alpha + 180, 360) - 180;
  };
  /**
   * Calculate the euclidean distance between two
   * points.
   *
   * @param {List<number>} point1 - The first point
   * @param {List<number>} point2 - The second point
   * @return {number} The distance between the two points.
   */

  var dist = function dist(point1, point2) {
    var sum = point1.reduce(function (acc, x1i, i) {
      var x2i = point2[i];
      return acc + Math.pow(x2i - x1i, 2);
    }, 0);
    return Math.sqrt(sum);
  };
  var ANGLE_ROUNDING = 10e-8;
  /**
   * @param {number[]} a - The first point.
   * @param {number[]} b - The second point, center of the angle.
   * @param {number[]} c - The third point.
   * @return {number} The angle abc (in degrees) rounded at the 8th decimal.
   */

  var angle = function angle(a, b, c) {
    var lab = dist(a, b);
    var lbc = dist(b, c);
    var lac = dist(a, c);
    var cos = (Math.pow(lab, 2) + Math.pow(lbc, 2) - Math.pow(lac, 2)) / (2 * lab * lbc); // Due to rounding, it can happen than cos ends up being slight > 1 or slightly < -1.
    // This fixes it.

    var adjustedCos = Math.max(-1, Math.min(1, cos));
    var angleABC = source(Math.acos(adjustedCos)); // Round the angle to avoid rounding issues.

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

  var findMaxEntry = function findMaxEntry(list, comp) {
    return list.slice(0).reduce(function (result, item, index) {
      if (comp(result[1], item) > 1) return [index, item];
      return result;
    }, [0, list[0]]);
  };
  /**
   * Converts the coordinates of a point in polar coordinates (angle in degrees).
   *
   * @param  {number[]} point - A point.
   * @param  {number[]} [pole=[0, 0]] - The pole of a polar coordinate
   *                                    system
   * @return {{azymuth, radius}} The angle coordinate of the point in the polar
   *                             coordinate system in degrees.
   */

  var toPolar = function toPolar(_ref, _temp) {
    var px = _ref[0],
        py = _ref[1];

    var _ref2 = _temp === void 0 ? [0, 0] : _temp,
        cx = _ref2[0],
        cy = _ref2[1];

    var x = px - cx;
    var y = py - cy;
    return {
      azymuth: source(Math.atan2(y, x)),
      radius: Math.sqrt(x * x + y * y)
    };
  };
  /**
   * @param  {string} str - A valid html fragment that could be contained in a
   *                      <div>.
   * @param  {Document} [doc=document] - The document to use.
   * @return {HTMLCollection} - The html fragment parsed as an HTML collection.
   *
   * Warning: any content that cannot be directly contained in a div, e.g. <td />
   * will fail.
   */

  var strToHTML = function strToHTML(str, doc) {
    if (doc === void 0) {
      doc = document;
    }

    var div = doc.createElement('div');
    div.innerHTML = str;
    return div.children;
  };

  // Create a custom pointer event from a touch event.
  var createPEventFromTouchEvent = function createPEventFromTouchEvent(touchEvt) {
    var touchList = Array.from(touchEvt.targetTouches);
    var sumX = touchList.reduce(function (acc, t) {
      return acc + t.clientX;
    }, 0);
    var sumY = touchList.reduce(function (acc, t) {
      return acc + t.clientY;
    }, 0);
    var meanX = sumX / touchList.length;
    var meanY = sumY / touchList.length;
    return {
      originalEvent: touchEvt,
      position: [meanX, meanY],
      timeStamp: touchEvt.timeStamp
    };
  }; // Create a custom pointer from a mouse event.

  var createPEventFromMouseEvent = function createPEventFromMouseEvent(mouseEvt) {
    return {
      originalEvent: mouseEvt,
      position: [mouseEvt.clientX, mouseEvt.clientY],
      timeStamp: mouseEvt.timeStamp
    };
  };

  var mouseDrags = function mouseDrags(rootDOM) {
    return rxjs.fromEvent(rootDOM, 'mousedown').pipe(operators.map(function (downEvt) {
      // Make sure we include the first mouse down event.
      var drag$ = rxjs.merge(rxjs.of(downEvt), rxjs.fromEvent(rootDOM, 'mousemove')).pipe(operators.takeUntil(rxjs.fromEvent(rootDOM, 'mouseup')), // Publish it as a behavior so that any new subscription will
      // get the last drag position.
      operators.publishBehavior());
      drag$.connect();
      return drag$;
    }), operators.map(function (o) {
      return o.pipe(operators.map(function () {
        return createPEventFromMouseEvent.apply(void 0, arguments);
      }));
    }));
  }; // Higher order observable tracking touch drags.

  var touchDrags = function touchDrags(rootDOM) {
    return rxjs.fromEvent(rootDOM, 'touchstart').pipe( // Menu is supposed to have pointer-events: none so we can safely rely on
    // targetTouches.
    operators.filter(function (evt) {
      return evt.targetTouches.length === 1;
    }), operators.map(function (firstEvent) {
      var drag$ = rxjs.fromEvent(rootDOM, 'touchmove').pipe(operators.startWith(firstEvent), operators.takeUntil(rxjs.merge(rxjs.fromEvent(rootDOM, 'touchend'), rxjs.fromEvent(rootDOM, 'touchcancel'), rxjs.fromEvent(rootDOM, 'touchstart')).pipe(operators.filter(function (evt) {
        return evt.targetTouches.length !== 1;
      }))), operators.publishBehavior()); // FIXME: the line below retains the subscription until next touch end.

      drag$.connect();
      return drag$;
    }), operators.map(function (o) {
      return o.pipe(operators.map(createPEventFromTouchEvent));
    }));
  };
  /**
   * @param {HTMLElement} rootDOM - the DOM element to observe pointer events on.
   * @return {Observable} A higher order observable that drag observables. The sub-observables are
   *                      published as behaviors so that any new subscription immediately get the last
   *                      position.
   * @param {function[]} [dragObsFactories] - factory to use to observe drags.
   */

  var watchDrags = function watchDrags(rootDOM, dragObsFactories) {
    if (dragObsFactories === void 0) {
      dragObsFactories = [touchDrags, mouseDrags];
    }

    return rxjs.merge.apply(void 0, dragObsFactories.map(function (f) {
      return f(rootDOM);
    }));
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

    return drag$.pipe(operators.scan(function (_ref, cur) {
      var prev = _ref[0];
      // Initial value.
      if (prev == null) return [cur, false]; // End of drag can never be a long move. Such events aren't supposed to be
      // emitted by drag observable though.

      if (cur.type === 'end' || cur.type === 'cancel') return [cur, false]; // If the distance is still below the threshold, re-emit the previous
      // event. It will be filtered-out later, but will come back again as
      // prev on the next scan call.

      if (dist(prev.position, cur.position) < movementsThreshold) return [prev, false]; // Otherwise, emit the new event.

      return [cur, true];
    }, []), operators.filter(function (_ref2) {
      var pass = _ref2[1];
      return pass;
    }), operators.map(function (x) {
      return x[0];
    }));
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

    return rxjs.merge(drag$.pipe(operators.first()), longMoves(drag$, movementsThreshold)).pipe( // Emit when no long movements happend for delay time.
    operators.debounceTime(delay, scheduler), // debounceTime emits the last item when the source observable completes.
    // We don't want that here so we only take until drag is done.
    operators.takeUntil(drag$.pipe(operators.last())), // Make sure we do emit the last position.
    operators.withLatestFrom(drag$, function (_, last_) {
      return last_;
    }));
  });

  /**
   * Augment a drag$ observable so that events also include the stroke.
   * @param {Observable} drag$ - An observable of drag movements.
   * @param {List<number[]>} initStroke - Initial stroke.
   * @return {Observable} An observable on the gesture drawing.
   */

  var draw = (function (drag$, _ref) {
    var _ref$initStroke = _ref.initStroke,
        initStroke = _ref$initStroke === void 0 ? [] : _ref$initStroke,
        _ref$type = _ref.type,
        type = _ref$type === void 0 ? undefined : _ref$type;
    var typeOpts = type === undefined ? {} : {
      type: type
    };
    return drag$.pipe(operators.scan(function (acc, notification) {
      return _extends({
        stroke: [].concat(acc.stroke, [notification.position])
      }, typeOpts, {}, notification);
    }, {
      stroke: initStroke
    }));
  });

  var noviceMoves = function noviceMoves(drag$, menu, _ref) {
    var menuCenter = _ref.menuCenter,
        minSelectionDist = _ref.minSelectionDist;
    // Analyse local movements.
    var moves$ = drag$.pipe(operators.scan(function (last_, n) {
      var _toPolar = toPolar(n.position, menuCenter),
          azymuth = _toPolar.azymuth,
          radius = _toPolar.radius;

      var active = radius < minSelectionDist ? null : menu.getNearestChild(azymuth);
      var type = last_.active === active ? 'move' : 'change';
      return _extends({
        active: active,
        type: type,
        azymuth: azymuth,
        radius: radius
      }, n);
    }, {
      active: null
    }), operators.startWith({
      type: 'open',
      menu: menu,
      center: menuCenter,
      timeStamp: performance ? performance.now() : Date.now()
    }), operators.share());
    var end$ = moves$.pipe(operators.startWith({}), operators.last(), operators.map(function (n) {
      return _extends({}, n, {
        type: n.active && n.active.isLeaf() ? 'select' : 'cancel',
        selection: n.active
      });
    }));
    return rxjs.merge(moves$, end$).pipe(operators.share());
  };
  var menuSelection = function menuSelection(move$, _ref2) {
    var subMenuOpeningDelay = _ref2.subMenuOpeningDelay,
        movementsThreshold = _ref2.movementsThreshold,
        minMenuSelectionDist = _ref2.minMenuSelectionDist;
    return (// Wait for a pause in the movements.
      dwellings(move$, subMenuOpeningDelay, movementsThreshold).pipe( // Filter dwellings occurring outside of the selection area.
      operators.filter(function (n) {
        return n.active && n.radius > minMenuSelectionDist && !n.active.isLeaf();
      }))
    );
  };
  var subMenuNavigation = function subMenuNavigation(menuSelection$, drag$, subNav, navOptions) {
    return menuSelection$.pipe(operators.map(function (n) {
      return subNav(drag$, n.active, _extends({
        menuCenter: n.position
      }, navOptions));
    }));
  };
  /**
   * @param {Observable} drag$ - An observable of drag movements.
   * @param {MMItem} menu - The model of the menu.
   * @param {object} options - Configuration options.
   * @return {Observable} An observable on the menu navigation events.
   */

  var noviceNavigation = function noviceNavigation(drag$, menu, _ref3) {
    var minSelectionDist = _ref3.minSelectionDist,
        minMenuSelectionDist = _ref3.minMenuSelectionDist,
        movementsThreshold = _ref3.movementsThreshold,
        subMenuOpeningDelay = _ref3.subMenuOpeningDelay,
        menuCenter = _ref3.menuCenter,
        _ref3$noviceMoves = _ref3.noviceMoves,
        noviceMoves_ = _ref3$noviceMoves === void 0 ? noviceMoves : _ref3$noviceMoves,
        _ref3$menuSelection = _ref3.menuSelection,
        menuSelection_ = _ref3$menuSelection === void 0 ? menuSelection : _ref3$menuSelection,
        _ref3$subMenuNavigati = _ref3.subMenuNavigation,
        subMenuNavigation_ = _ref3$subMenuNavigati === void 0 ? subMenuNavigation : _ref3$subMenuNavigati;
    // Observe the local navigation.
    var move$ = noviceMoves_(drag$, menu, {
      menuCenter: menuCenter,
      minSelectionDist: minSelectionDist
    }).pipe(operators.share()); // Look for (sub)menu selection.

    var menuSelection$ = menuSelection_(move$, {
      subMenuOpeningDelay: subMenuOpeningDelay,
      movementsThreshold: movementsThreshold,
      minMenuSelectionDist: minMenuSelectionDist
    }); // Higher order observable on navigation inside sub-menus.

    var subMenuNavigation$ = subMenuNavigation_(menuSelection$, drag$, noviceNavigation, {
      minSelectionDist: minSelectionDist,
      minMenuSelectionDist: minMenuSelectionDist,
      movementsThreshold: movementsThreshold,
      subMenuOpeningDelay: subMenuOpeningDelay,
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

  var findNextPointFurtherThan = function findNextPointFurtherThan(pointList, minDist, _temp) {
    var _ref = _temp === void 0 ? {} : _temp,
        _ref$direction = _ref.direction,
        direction = _ref$direction === void 0 ? 1 : _ref$direction,
        _ref$startIndex = _ref.startIndex,
        startIndex = _ref$startIndex === void 0 ? direction > 0 ? 0 : pointList.length - 1 : _ref$startIndex,
        _ref$refPoint = _ref.refPoint,
        refPoint = _ref$refPoint === void 0 ? pointList[startIndex] : _ref$refPoint;

    var step = direction / Math.abs(direction);
    var n = pointList.length;

    for (var i = startIndex; i < n && i >= 0; i += step) {
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

  var findMiddlePointForMinAngle = function findMiddlePointForMinAngle(pointA, pointC, pointList, _temp2) {
    var _ref2 = _temp2 === void 0 ? {} : _temp2,
        _ref2$startIndex = _ref2.startIndex,
        startIndex = _ref2$startIndex === void 0 ? 0 : _ref2$startIndex,
        _ref2$endIndex = _ref2.endIndex,
        endIndex = _ref2$endIndex === void 0 ? pointList.length - 1 : _ref2$endIndex;

    var minAngle = Infinity;
    var maxAngleIndex = -1;

    for (var i = startIndex; i <= endIndex; i += 1) {
      var thisAngle = angle(pointA, pointList[i], pointC);

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

  var getStrokeArticulationPoints = function getStrokeArticulationPoints(stroke, expectedSegmentLength, angleThreshold) {
    var n = stroke.length;
    if (n === 0) return [];
    var w = expectedSegmentLength * 0.3; // Add the first point of the stroke.

    var articulationPoints = [stroke[0]];
    var ai = 0;
    var a = stroke[ai];

    while (ai < n) {
      var ci = findNextPointFurtherThan(stroke, w, {
        startIndex: ai + 2,
        refPoint: a
      });
      if (ci < 0) break;
      var c = stroke[ci];
      var labi = findNextPointFurtherThan(stroke, w / 8, {
        startIndex: ai + 1,
        refPoint: a
      });
      var lbci = findNextPointFurtherThan(stroke, w / 8, {
        startIndex: ci - 1,
        refPoint: c,
        direction: -1
      });

      var _findMiddlePointForMi = findMiddlePointForMinAngle(a, stroke[ci], stroke, {
        startIndex: labi,
        endIndex: lbci
      }),
          bi = _findMiddlePointForMi.index,
          angleABC = _findMiddlePointForMi.angle;

      if (bi > 0 && Math.abs(180 - angleABC) > angleThreshold) {
        var b = stroke[bi];
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

  var strokeLength = (function (stroke) {
    return stroke.reduce(function (res, current) {
      var prev = res.prev || current;
      return {
        prev: current,
        length: res.length + dist(prev, current)
      };
    }, {
      length: 0
    }).length;
  });

  /**
   * @param {Point[]} points - A list of points.
   * @return {Segment[]} The list of segments joining the points of `points`.
   */

  var pointsToSegments = function pointsToSegments(points) {
    return points.slice(1).reduce(function (_ref, current) {
      var segments = _ref.segments,
          last = _ref.last;
      segments.push([last, current]);
      return {
        segments: segments,
        last: current
      };
    }, {
      last: points[0],
      segments: []
    }).segments;
  };
  /**
   * @param {Item} model - The marking menu model.
   * @param {{ angle }[]} segments - A list of segments to walk the model.
   * @param {number} [startIndex=0] - The start index in the angle list.
   * @return {Item} The corresponding item found by walking the model.
   */

  var walkMMModel = function walkMMModel(model, segments, startIndex) {
    if (startIndex === void 0) {
      startIndex = 0;
    }

    if (!model || segments.length === 0 || model.isLeaf()) return null;
    var item = model.getNearestChild(segments[startIndex].angle);

    if (startIndex + 1 >= segments.length) {
      return item;
    }

    return walkMMModel(item, segments, startIndex + 1);
  };
  var segmentAngle = function segmentAngle(a, b) {
    return source(Math.atan2(b[1] - a[1], b[0] - a[0]));
  };
  /**
   * @param {{angle, length}[]} segments - A list of segments.
   * @return {{angle, length}[]} A new list of segments with the longest segments divided in two.
   */

  var divideLongestSegment = function divideLongestSegment(segments) {
    var _findMaxEntry = findMaxEntry(segments, function (s1, s2) {
      return s2.length - s1.length;
    }),
        longestI = _findMaxEntry[0],
        longest = _findMaxEntry[1];

    return [].concat(segments.slice(0, longestI), [{
      length: longest.length / 2,
      angle: longest.angle
    }, {
      length: longest.length / 2,
      angle: longest.angle
    }], segments.slice(longestI + 1));
  };
  /**
   * @param {Item} model - The marking menu model.
   * @param {{length, angle}[]} segments - A list of segments.
   * @param {number} [maxDepth=model.getMaxDepth()] - The maximum depth of the item.
   * @return {Item} The selected item.
   */

  var findMMItem = function findMMItem(model, segments, maxDepth) {
    if (maxDepth === void 0) {
      maxDepth = model.getMaxDepth();
    }

    // If there is not segments, there is no selection to find.
    if (!segments.length) return null; // While we haven't found a leaf item, divide the longest segment and walk the model.

    var currentSegments = segments;
    var currentItem = null;

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

  var recognizeMMStroke = function recognizeMMStroke(stroke, model, _temp) {
    var _ref2 = _temp === void 0 ? {} : _temp,
        _ref2$maxDepth = _ref2.maxDepth,
        maxDepth_ = _ref2$maxDepth === void 0 ? model.getMaxDepth() : _ref2$maxDepth,
        _ref2$requireMenu = _ref2.requireMenu,
        requireMenu = _ref2$requireMenu === void 0 ? false : _ref2$requireMenu,
        _ref2$requireLeaf = _ref2.requireLeaf,
        requireLeaf = _ref2$requireLeaf === void 0 ? !requireMenu : _ref2$requireLeaf;

    if (requireLeaf && requireMenu) {
      throw new Error('The result cannot be both a leaf and a menu');
    }

    var maxDepth = maxDepth_ < 0 ? model.getMaxDepth() + maxDepth_ : maxDepth_;
    var maxMenuBreadth = model.getMaxBreadth();
    var length = strokeLength(stroke);
    var expectedSegmentLength = length / maxDepth;
    var sensitivity = 0.75;
    var angleThreshold = 360 / maxMenuBreadth / 2 / sensitivity;
    var articulationPoints = getStrokeArticulationPoints(stroke, expectedSegmentLength, angleThreshold);
    var minSegmentSize = expectedSegmentLength / 3; // Get the segments of the marking menus.

    var segments = pointsToSegments(articulationPoints) // Change the representation of the segment to include its length.
    .map(function (seg) {
      return {
        points: seg,
        length: dist.apply(void 0, seg)
      };
    }) // Remove the segments that are too small.
    .filter(function (seg) {
      return seg.length > minSegmentSize;
    }) // Change again the representation of the segment to include its length but not its
    // its points anymore.
    .map(function (seg) {
      return {
        angle: segmentAngle.apply(void 0, seg.points),
        length: seg.length
      };
    });
    var item = findMMItem(model, segments, maxDepth);

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
    var draw$ = draw(drag$, {
      initStroke: initStroke,
      type: 'draw'
    }).pipe(operators.share()); // Track the end of the drawing and attempt to recognize the gesture.

    var end$ = draw$.pipe(operators.startWith(null), operators.last(), operators.map(function (e) {
      if (!e) return {
        type: 'cancel'
      };
      var selection = recognizeMMStroke(e.stroke, model);

      if (selection) {
        return _extends({}, e, {
          type: 'select',
          selection: selection
        });
      }

      return _extends({}, e, {
        type: 'cancel'
      });
    }));
    return rxjs.merge(draw$, end$);
  });

  var confirmedNoviceNavigationHOO = function confirmedNoviceNavigationHOO(drag$, start, model, options) {
    return dwellings(drag$, options.noviceDwellingTime, options.movementsThreshold).pipe(operators.take(1), operators.map(function () {
      return (start != null ? rxjs.of(start) : drag$).pipe(operators.take(1), operators.mergeMap(function (start_) {
        return noviceNavigation( // Same as before, skip the first.
        drag$.pipe(operators.skip(1)), model, _extends({}, options, {
          menuCenter: start_.position
        })).pipe(operators.map(function (n) {
          return _extends({}, n, {
            mode: 'novice'
          });
        }));
      }));
    }));
  };
  var expertToNoviceSwitchHOO = function expertToNoviceSwitchHOO(drag$, model, initStroke, options) {
    return dwellings(draw(drag$, {
      initStroke: initStroke
    }), options.noviceDwellingTime, options.movementsThreshold).pipe(operators.take(1), operators.map(function (evt) {
      // Look for the furthest menu (not leaf).
      var menu = recognizeMMStroke(evt.stroke, model, {
        maxDepth: -1,
        requireMenu: true
      });

      if (!menu || menu.isRoot()) {
        return rxjs.of(_extends({}, evt, {
          type: 'cancel'
        }));
      } // Start a novice navigation from there.


      return noviceNavigation(drag$.pipe(operators.skip(1)), menu, _extends({}, options, {
        menuCenter: evt.position
      }));
    }));
  };
  var confirmedExpertNavigationHOO = function confirmedExpertNavigationHOO(drag$, model, _temp) {
    var _ref = _temp === void 0 ? {} : _temp,
        _ref$expertToNoviceSw = _ref.expertToNoviceSwitchHOO,
        expertToNoviceSwitchHOO_ = _ref$expertToNoviceSw === void 0 ? expertToNoviceSwitchHOO : _ref$expertToNoviceSw,
        options = _objectWithoutPropertiesLoose(_ref, ["expertToNoviceSwitchHOO"]);

    return longMoves(draw(drag$, {
      type: 'draw'
    }), options.movementsThreshold).pipe(operators.take(1), operators.map(function (e) {
      var expertNav$ = expertNavigation( // Drag always return the last value when observed, in this case we are
      // not interested in it as it has already been took into account.
      drag$.pipe(operators.skip(1)), model, e.stroke).pipe(operators.map(function (n) {
        return _extends({}, n, {
          mode: 'expert'
        });
      }));
      return expertToNoviceSwitchHOO_(drag$, model, e.stroke, options).pipe(operators.startWith(expertNav$), operators.switchAll());
    }));
  };
  var startup = function startup(drag$, model) {
    return expertNavigation(drag$, model).pipe(operators.map(function (n, i) {
      return i === 0 ? _extends({}, n, {
        type: 'start',
        mode: 'startup'
      }) : _extends({}, n, {
        mode: 'startup'
      });
    }));
  };
  var navigationFromDrag = function navigationFromDrag(drag$, start, model, options, _temp2) {
    var _ref2 = _temp2 === void 0 ? {} : _temp2,
        _ref2$confirmedExpert = _ref2.confirmedExpertNavigationHOO,
        confirmedExpertNavigationHOO_ = _ref2$confirmedExpert === void 0 ? confirmedExpertNavigationHOO : _ref2$confirmedExpert,
        _ref2$confirmedNovice = _ref2.confirmedNoviceNavigationHOO,
        confirmedNoviceNavigationHOO_ = _ref2$confirmedNovice === void 0 ? confirmedNoviceNavigationHOO : _ref2$confirmedNovice,
        _ref2$startup = _ref2.startup,
        startup_ = _ref2$startup === void 0 ? startup : _ref2$startup;

    // Start up observable (while neither expert or novice are confirmed).
    var startUp$ = startup_(drag$, model); // Observable on confirmed expert navigation.

    var confirmedExpertNavigation$$ = confirmedExpertNavigationHOO_(drag$, model, options); // Observable on confirmed novice navigation.

    var confirmedNoviceNavigation$$ = confirmedNoviceNavigationHOO_(drag$, start, model, options); // Observable on expert or novice navigation once confirmed.

    var confirmedNavigation$$ = rxjs.race(confirmedExpertNavigation$$, confirmedNoviceNavigation$$); // Start with startup navigation (similar to expert) but switch to the
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

    return drags$.pipe(operators.exhaustMap(function (drag$) {
      return drag$.pipe(operators.take(1), operators.mergeMap(function (start) {
        return navigationFromDrag_(drag$, start, menu, options);
      }));
    }));
  });

  var pug = (function(exports) {

    var pug_has_own_property = Object.prototype.hasOwnProperty;

    /**
     * Merge two attribute objects giving precedence
     * to values in object `b`. Classes are special-cased
     * allowing for arrays and merging/joining appropriately
     * resulting in a string.
     *
     * @param {Object} a
     * @param {Object} b
     * @return {Object} a
     * @api private
     */

    exports.merge = pug_merge;
    function pug_merge(a, b) {
      if (arguments.length === 1) {
        var attrs = a[0];
        for (var i = 1; i < a.length; i++) {
          attrs = pug_merge(attrs, a[i]);
        }
        return attrs;
      }

      for (var key in b) {
        if (key === 'class') {
          var valA = a[key] || [];
          a[key] = (Array.isArray(valA) ? valA : [valA]).concat(b[key] || []);
        } else if (key === 'style') {
          var valA = pug_style(a[key]);
          valA = valA && valA[valA.length - 1] !== ';' ? valA + ';' : valA;
          var valB = pug_style(b[key]);
          valB = valB && valB[valB.length - 1] !== ';' ? valB + ';' : valB;
          a[key] = valA + valB;
        } else {
          a[key] = b[key];
        }
      }

      return a;
    }
    /**
     * Process array, object, or string as a string of classes delimited by a space.
     *
     * If `val` is an array, all members of it and its subarrays are counted as
     * classes. If `escaping` is an array, then whether or not the item in `val` is
     * escaped depends on the corresponding item in `escaping`. If `escaping` is
     * not an array, no escaping is done.
     *
     * If `val` is an object, all the keys whose value is truthy are counted as
     * classes. No escaping is done.
     *
     * If `val` is a string, it is counted as a class. No escaping is done.
     *
     * @param {(Array.<string>|Object.<string, boolean>|string)} val
     * @param {?Array.<string>} escaping
     * @return {String}
     */
    exports.classes = pug_classes;
    function pug_classes_array(val, escaping) {
      var classString = '', className, padding = '', escapeEnabled = Array.isArray(escaping);
      for (var i = 0; i < val.length; i++) {
        className = pug_classes(val[i]);
        if (!className) continue;
        escapeEnabled && escaping[i] && (className = pug_escape(className));
        classString = classString + padding + className;
        padding = ' ';
      }
      return classString;
    }
    function pug_classes_object(val) {
      var classString = '', padding = '';
      for (var key in val) {
        if (key && val[key] && pug_has_own_property.call(val, key)) {
          classString = classString + padding + key;
          padding = ' ';
        }
      }
      return classString;
    }
    function pug_classes(val, escaping) {
      if (Array.isArray(val)) {
        return pug_classes_array(val, escaping);
      } else if (val && typeof val === 'object') {
        return pug_classes_object(val);
      } else {
        return val || '';
      }
    }

    /**
     * Convert object or string to a string of CSS styles delimited by a semicolon.
     *
     * @param {(Object.<string, string>|string)} val
     * @return {String}
     */

    exports.style = pug_style;
    function pug_style(val) {
      if (!val) return '';
      if (typeof val === 'object') {
        var out = '';
        for (var style in val) {
          /* istanbul ignore else */
          if (pug_has_own_property.call(val, style)) {
            out = out + style + ':' + val[style] + ';';
          }
        }
        return out;
      } else {
        return val + '';
      }
    }
    /**
     * Render the given attribute.
     *
     * @param {String} key
     * @param {String} val
     * @param {Boolean} escaped
     * @param {Boolean} terse
     * @return {String}
     */
    exports.attr = pug_attr;
    function pug_attr(key, val, escaped, terse) {
      if (val === false || val == null || !val && (key === 'class' || key === 'style')) {
        return '';
      }
      if (val === true) {
        return ' ' + (terse ? key : key + '="' + key + '"');
      }
      var type = typeof val;
      if ((type === 'object' || type === 'function') && typeof val.toJSON === 'function') {
        val = val.toJSON();
      }
      if (typeof val !== 'string') {
        val = JSON.stringify(val);
        if (!escaped && val.indexOf('"') !== -1) {
          return ' ' + key + '=\'' + val.replace(/'/g, '&#39;') + '\'';
        }
      }
      if (escaped) val = pug_escape(val);
      return ' ' + key + '="' + val + '"';
    }
    /**
     * Render the given attributes object.
     *
     * @param {Object} obj
     * @param {Object} terse whether to use HTML5 terse boolean attributes
     * @return {String}
     */
    exports.attrs = pug_attrs;
    function pug_attrs(obj, terse){
      var attrs = '';

      for (var key in obj) {
        if (pug_has_own_property.call(obj, key)) {
          var val = obj[key];

          if ('class' === key) {
            val = pug_classes(val);
            attrs = pug_attr(key, val, false, terse) + attrs;
            continue;
          }
          if ('style' === key) {
            val = pug_style(val);
          }
          attrs += pug_attr(key, val, false, terse);
        }
      }

      return attrs;
    }
    /**
     * Escape the given string of `html`.
     *
     * @param {String} html
     * @return {String}
     * @api private
     */

    var pug_match_html = /["&<>]/;
    exports.escape = pug_escape;
    function pug_escape(_html){
      var html = '' + _html;
      var regexResult = pug_match_html.exec(html);
      if (!regexResult) return _html;

      var result = '';
      var i, lastIndex, escape;
      for (i = regexResult.index, lastIndex = 0; i < html.length; i++) {
        switch (html.charCodeAt(i)) {
          case 34: escape = '&quot;'; break;
          case 38: escape = '&amp;'; break;
          case 60: escape = '&lt;'; break;
          case 62: escape = '&gt;'; break;
          default: continue;
        }
        if (lastIndex !== i) result += html.substring(lastIndex, i);
        lastIndex = i + 1;
        result += escape;
      }
      if (lastIndex !== i) return result + html.substring(lastIndex, i);
      else return result;
    }
    /**
     * Re-throw the given `err` in context to the
     * the pug in `filename` at the given `lineno`.
     *
     * @param {Error} err
     * @param {String} filename
     * @param {String} lineno
     * @param {String} str original source
     * @api private
     */

    exports.rethrow = pug_rethrow;
    function pug_rethrow(err, filename, lineno, str){
      if (!(err instanceof Error)) throw err;
      if ((typeof window != 'undefined' || !filename) && !str) {
        err.message += ' on line ' + lineno;
        throw err;
      }
      try {
        str = str || require('fs').readFileSync(filename, 'utf8');
      } catch (ex) {
        pug_rethrow(err, null, lineno);
      }
      var context = 3
        , lines = str.split('\n')
        , start = Math.max(lineno - context, 0)
        , end = Math.min(lines.length, lineno + context);

      // Error context
      var context = lines.slice(start, end).map(function(line, i){
        var curr = i + start + 1;
        return (curr == lineno ? '  > ' : '    ')
          + curr
          + '| '
          + line;
      }).join('\n');

      // Alter exception message
      err.path = filename;
      err.message = (filename || 'Pug') + ':' + lineno
        + '\n' + context + '\n\n' + err.message;
      throw err;
    }
    return exports
  })({});

  function template(locals) {var pug_html = "", pug_interp;var pug_debug_filename, pug_debug_line;try {var pug_debug_sources = {};
  ;var locals_for_with = (locals || {});(function (center, items) {
  pug_html = pug_html + "\u003Cdiv" + (" class=\"marking-menu\""+pug.attr("style", pug.style({ left: `${center[0]}px`, top: `${center[1]}px` }), true, true)) + "\u003E";
  // iterate items
  ;(function(){
    var $$obj = items;
    if ('number' == typeof $$obj.length) {
        for (var pug_index0 = 0, $$l = $$obj.length; pug_index0 < $$l; pug_index0++) {
          var item = $$obj[pug_index0];
  pug_html = pug_html + "\u003Cdiv" + (" class=\"marking-menu-item\""+pug.attr("data-item-id", item.id, true, true)+pug.attr("data-item-angle", item.angle, true, true)) + "\u003E";
  pug_html = pug_html + "\u003Cdiv class=\"marking-menu-line\"\u003E\u003C\u002Fdiv\u003E";
  pug_html = pug_html + "\u003Cdiv class=\"marking-menu-label\"\u003E";
  pug_html = pug_html + (pug.escape(null == (pug_interp = item.name) ? "" : pug_interp)) + "\u003C\u002Fdiv\u003E\u003C\u002Fdiv\u003E";
        }
    } else {
      var $$l = 0;
      for (var pug_index0 in $$obj) {
        $$l++;
        var item = $$obj[pug_index0];
  pug_html = pug_html + "\u003Cdiv" + (" class=\"marking-menu-item\""+pug.attr("data-item-id", item.id, true, true)+pug.attr("data-item-angle", item.angle, true, true)) + "\u003E";
  pug_html = pug_html + "\u003Cdiv class=\"marking-menu-line\"\u003E\u003C\u002Fdiv\u003E";
  pug_html = pug_html + "\u003Cdiv class=\"marking-menu-label\"\u003E";
  pug_html = pug_html + (pug.escape(null == (pug_interp = item.name) ? "" : pug_interp)) + "\u003C\u002Fdiv\u003E\u003C\u002Fdiv\u003E";
      }
    }
  }).call(this);

  pug_html = pug_html + "\u003C\u002Fdiv\u003E";}.call(this,"center" in locals_for_with?locals_for_with.center:typeof center!=="undefined"?center:undefined,"items" in locals_for_with?locals_for_with.items:typeof items!=="undefined"?items:undefined));} catch (err) {pug.rethrow(err, pug_debug_filename, pug_debug_line, pug_debug_sources[pug_debug_filename]);}return pug_html;}

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

  var createMenu = function createMenu(parent, model, center, current, _temp) {
    var _ref = _temp === void 0 ? {} : _temp,
        _ref$doc = _ref.doc,
        doc = _ref$doc === void 0 ? document : _ref$doc;

    // Create the DOM.
    var main = strToHTML(template({
      items: model.children,
      center: center
    }), doc)[0];
    parent.appendChild(main); // Clear any  active items.

    var clearActiveItems = function clearActiveItems() {
      Array.from(main.querySelectorAll('.active')).forEach(function (itemDom) {
        return itemDom.classList.remove('active');
      });
    }; // Return an item DOM element from its id.


    var getItemDom = function getItemDom(itemId) {
      return main.querySelector(".marking-menu-item[data-item-id=\"" + itemId + "\"]");
    }; // Mark an item as active.


    var setActive = function setActive(itemId) {
      // Clear any  active items.
      clearActiveItems(); // Set the active class.

      if (itemId || itemId === 0) {
        getItemDom(itemId).classList.add('active');
      }
    }; // Function to remove the menu.


    var remove = function remove() {
      return parent.removeChild(main);
    }; // Initialize the menu.


    if (current) setActive(current); // Create the interface.

    return {
      setActive: setActive,
      remove: remove
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
  var createStrokeCanvas = (function (parent, _ref) {
    var _ref$doc = _ref.doc,
        doc = _ref$doc === void 0 ? document : _ref$doc,
        _ref$lineWidth = _ref.lineWidth,
        lineWidth = _ref$lineWidth === void 0 ? 2 : _ref$lineWidth,
        _ref$lineColor = _ref.lineColor,
        lineColor = _ref$lineColor === void 0 ? 'black' : _ref$lineColor,
        _ref$pointRadius = _ref.pointRadius,
        pointRadius = _ref$pointRadius === void 0 ? 0 : _ref$pointRadius,
        _ref$pointColor = _ref.pointColor,
        pointColor = _ref$pointColor === void 0 ? lineColor : _ref$pointColor,
        _ref$ptSize = _ref.ptSize,
        ptSize = _ref$ptSize === void 0 ? window.devicePixelRatio ? 1 / window.devicePixelRatio : 1 : _ref$ptSize;

    // Create the canvas.
    var _parent$getBoundingCl = parent.getBoundingClientRect(),
        width = _parent$getBoundingCl.width,
        height = _parent$getBoundingCl.height;

    var canvas = doc.createElement('canvas');
    canvas.width = width / ptSize;
    canvas.height = height / ptSize;
    Object.assign(canvas.style, {
      position: 'absolute',
      left: 0,
      top: 0,
      width: width + "px",
      height: height + "px",
      'pointer-events': 'none'
    });
    parent.appendChild(canvas); // Get the canvas' context and set it up

    var ctx = canvas.getContext('2d'); // Scale to the device pixel ratio.

    ctx.scale(1 / ptSize, 1 / ptSize);
    /**
     * @param {number[]} point - Position of the point to draw.
     * @return {undefined}
     */

    var drawPoint = function drawPoint(_ref2) {
      var x = _ref2[0],
          y = _ref2[1];
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


    var clear = function clear() {
      ctx.clearRect(0, 0, width, height);
    };
    /**
     * Draw the stroke.
     *
     * @param {List<number[]>} stroke - The new stroke.
     * @return {undefined}
     */


    var drawStroke = function drawStroke(stroke) {
      ctx.save();
      ctx.fillStyle = 'none';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      stroke.forEach(function (point, i) {
        if (i === 0) ctx.moveTo.apply(ctx, point);else ctx.lineTo.apply(ctx, point);
      });
      ctx.stroke();
      ctx.restore();
    };
    /**
     * Destroy the canvas.
     * @return {undefined}
     */


    var remove = function remove() {
      canvas.remove();
    };

    return {
      clear: clear,
      drawStroke: drawStroke,
      drawPoint: drawPoint,
      remove: remove
    };
  });

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var rafThrottle_1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var rafThrottle = function rafThrottle(callback) {
    var requestId = void 0;

    var later = function later(context, args) {
      return function () {
        requestId = null;
        callback.apply(context, args);
      };
    };

    var throttled = function throttled() {
      if (requestId === null || requestId === undefined) {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        requestId = requestAnimationFrame(later(this, args));
      }
    };

    throttled.cancel = function () {
      return cancelAnimationFrame(requestId);
    };

    return throttled;
  };

  exports.default = rafThrottle;
  });

  var rafThrottle = unwrapExports(rafThrottle_1);

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

  var connectLayout = (function (parentDOM, navigation$, createMenuLayout, createUpperStrokeCanvas, createLowerStrokeCanvas, createGestureFeedback, log) {
    // The menu object.
    var menu = null; // A stroke drawn on top of the menu.

    var upperStrokeCanvas = null; // A stroke drawn below the menu.

    var lowerStrokeCanvas = null; // The points of the lower strokes.

    var lowerStroke = null; // The points of the upper stroke.

    var upperStroke = null;
    var gestureFeedback = createGestureFeedback(parentDOM);

    var closeMenu = function closeMenu() {
      menu.remove();
      menu = null;
    };

    var openMenu = function openMenu(model, position) {
      var cbr = parentDOM.getBoundingClientRect();
      menu = createMenuLayout(parentDOM, model, [position[0] - cbr.left, position[1] - cbr.top]);
    };

    var setActive = function setActive(id) {
      menu.setActive(id);
    };

    var startUpperStroke = function startUpperStroke(position) {
      upperStrokeCanvas = createUpperStrokeCanvas(parentDOM);
      upperStroke = [position];
      upperStrokeCanvas.drawStroke(upperStroke);
    };

    var noviceMove = rafThrottle(function (position) {
      if (upperStrokeCanvas) {
        upperStrokeCanvas.clear();

        if (position) {
          upperStroke = [upperStroke[0], position];
          upperStrokeCanvas.drawStroke(upperStroke);
        }

        upperStrokeCanvas.drawPoint(upperStroke[0]);
      }
    });
    var expertDraw = rafThrottle(function (stroke) {
      // FIXME: Not very efficient.
      if (upperStrokeCanvas) {
        upperStrokeCanvas.clear();
        upperStroke = stroke.slice();
        upperStrokeCanvas.drawStroke(upperStroke);
      }
    });

    var clearUpperStroke = function clearUpperStroke() {
      upperStrokeCanvas.remove();
      upperStrokeCanvas = null;
      upperStroke = null;
    };

    var swapUpperStroke = function swapUpperStroke() {
      lowerStroke = lowerStroke ? [].concat(lowerStroke, upperStroke) : upperStroke;
      clearUpperStroke();
      lowerStrokeCanvas = lowerStrokeCanvas || createLowerStrokeCanvas(parentDOM);
      lowerStrokeCanvas.drawStroke(lowerStroke);
    };

    var clearLowerStroke = function clearLowerStroke() {
      if (lowerStrokeCanvas) {
        lowerStrokeCanvas.remove();
        lowerStrokeCanvas = null;
      }

      lowerStroke = null;
    };

    var showGestureFeedback = function showGestureFeedback(isCanceled) {
      gestureFeedback.show(lowerStroke ? [].concat(lowerStroke, upperStroke) : upperStroke, isCanceled);
    };

    var cleanUp = function cleanUp() {
      // Make sure everything is cleaned upon completion.
      if (menu) closeMenu();
      if (upperStrokeCanvas) clearUpperStroke();
      if (lowerStrokeCanvas) clearLowerStroke();
      gestureFeedback.remove(); // eslint-disable-next-line no-param-reassign

      parentDOM.style.cursor = '';
    };

    var onNotification = function onNotification(notification) {
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
          throw new Error("Invalid navigation notification type: " + notification.type);
      }
    };

    return navigation$.pipe(operators.tap({
      next: function next(notification) {
        try {
          onNotification(notification);
        } catch (e) {
          log.error(e);
          throw e;
        }
      },
      error: function error(e) {
        log.error(e);
        throw e;
      }
    }), operators.finalize(function () {
      try {
        cleanUp();
      } catch (e) {
        log.error(e);
        throw e;
      }
    }));
  });

  var createGestureFeedback = (function (parentDOM, _ref) {
    var duration = _ref.duration,
        _ref$strokeOptions = _ref.strokeOptions,
        strokeOptions = _ref$strokeOptions === void 0 ? {} : _ref$strokeOptions,
        _ref$canceledStrokeOp = _ref.canceledStrokeOptions,
        canceledStrokeOptions = _ref$canceledStrokeOp === void 0 ? {} : _ref$canceledStrokeOp;
    var strokeTimeoutEntries = [];

    var show = function show(stroke, isCanceled) {
      if (isCanceled === void 0) {
        isCanceled = false;
      }

      var canvas = createStrokeCanvas(parentDOM, _extends({}, strokeOptions, {}, isCanceled ? canceledStrokeOptions : {}));
      canvas.drawStroke(stroke);
      var timeoutEntry = {
        canvas: canvas,
        timeout: setTimeout(function () {
          // Remove the entry from the strokeTimeoutEntries.
          strokeTimeoutEntries = strokeTimeoutEntries.filter(function (x) {
            return x !== timeoutEntry;
          }); // Clear the stroke canvas.

          canvas.remove();
        }, duration)
      };
      strokeTimeoutEntries.push(timeoutEntry);
    };

    var remove = function remove() {
      strokeTimeoutEntries.forEach(function (_ref2) {
        var timeout = _ref2.timeout,
            canvas = _ref2.canvas;
        clearTimeout(timeout);
        canvas.remove();
      });
      strokeTimeoutEntries = [];
    };

    return {
      show: show,
      remove: remove
    };
  });

  var getAngleRange = function getAngleRange(items) {
    return items.length > 4 ? 45 : 90;
  };
  /**
   * Represents an item of the Marking Menu.
   */


  var MMItem =
  /*#__PURE__*/
  function () {
    /**
     * @param {String} id - The item's id. Required except for the root item.
     * @param {String} name - The item's name. Required except for the root item.
     * @param {Integer} angle - The item's angle. Required except for the root item.
     * @param {object} [options] - Some additional options.
     * @param {ItemModel} [options.parent] - The parent menu of the item.
     * @param {List<ItemModel>} [options.children] - The children of the item menu.
     */
    function MMItem(id, name, angle, _temp) {
      var _ref = _temp === void 0 ? {} : _temp,
          parent = _ref.parent,
          children = _ref.children;

      this.id = id;
      this.name = name;
      this.angle = angle;
      this.children = children;
      this.parent = parent;
    }

    var _proto = MMItem.prototype;

    _proto.isLeaf = function isLeaf() {
      return !this.children || this.children.length === 0;
    };

    _proto.isRoot = function isRoot() {
      return !this.parent;
    }
    /**
     * @param {String} childId - The identifier of the child to look for.
     * @return {Item} the children with the id `childId`.
     */
    ;

    _proto.getChild = function getChild(childId) {
      return this.children.find(function (child) {
        return child.id === childId;
      });
    }
    /**
     * @param {String} childName - The name of the children to look for.
     * @return {Item} the children with the name `childName`.
     */
    ;

    _proto.getChildrenByName = function getChildrenByName(childName) {
      return this.children.filter(function (child) {
        return child.name === childName;
      });
    }
    /**
     * @param {Integer} angle - An angle.
     * @return {Item} the closest children to the angle `angle`.
     */
    ;

    _proto.getNearestChild = function getNearestChild(angle) {
      return this.children.reduce(function (c1, c2) {
        var delta1 = Math.abs(deltaAngle(c1.angle, angle));
        var delta2 = Math.abs(deltaAngle(c2.angle, angle));
        return delta1 > delta2 ? c2 : c1;
      });
    }
    /**
     * @return {number} The maximum depth of the menu.
     */
    ;

    _proto.getMaxDepth = function getMaxDepth() {
      return this.isLeaf() ? 0 : Math.max.apply(Math, [0].concat(this.children.map(function (child) {
        return child.getMaxDepth();
      }))) + 1;
    }
    /**
     * @return {number} The maximum breadth of the menu.
     */
    ;

    _proto.getMaxBreadth = function getMaxBreadth() {
      return this.isLeaf() ? 0 : Math.max.apply(Math, [this.children.length].concat(this.children.map(function (child) {
        return child.getMaxBreadth();
      })));
    };

    return MMItem;
  }(); // Create the model item from a list of items.

  var recursivelyCreateModelItems = function recursivelyCreateModelItems(items, baseId, parent) {
    if (baseId === void 0) {
      baseId = undefined;
    }

    if (parent === void 0) {
      parent = undefined;
    }

    // Calculate the angle range for each items.
    var angleRange = getAngleRange(items); // Create the list of model items (frozen).

    return Object.freeze(items.map(function (item, i) {
      // Standard item id.
      var stdId = baseId ? [baseId, i].join('-') : i.toString(); // Create the item.

      var mmItem = new MMItem(item.id == null ? stdId : item.id, typeof item === 'string' ? item : item.name, i * angleRange, {
        parent: parent
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


  var createModel = function createModel(itemList) {
    var menu = new MMItem(null, null, null);
    menu.children = recursivelyCreateModelItems(itemList, undefined, menu);
    return Object.freeze(menu);
  };

  var exportNotification = function exportNotification(n) {
    return {
      type: n.type,
      mode: n.mode,
      position: n.position ? n.position.slice() : undefined,
      active: n.active,
      selection: n.selection,
      menuCenter: n.center ? n.center.slice() : undefined,
      timeStamp: n.timeStamp
    };
  };
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

  var main = (function (items, parentDOM, _temp) {
    var _ref = _temp === void 0 ? {} : _temp,
        _ref$minSelectionDist = _ref.minSelectionDist,
        minSelectionDist = _ref$minSelectionDist === void 0 ? 40 : _ref$minSelectionDist,
        _ref$minMenuSelection = _ref.minMenuSelectionDist,
        minMenuSelectionDist = _ref$minMenuSelection === void 0 ? 80 : _ref$minMenuSelection,
        _ref$subMenuOpeningDe = _ref.subMenuOpeningDelay,
        subMenuOpeningDelay = _ref$subMenuOpeningDe === void 0 ? 25 : _ref$subMenuOpeningDe,
        _ref$movementsThresho = _ref.movementsThreshold,
        movementsThreshold = _ref$movementsThresho === void 0 ? 5 : _ref$movementsThresho,
        _ref$noviceDwellingTi = _ref.noviceDwellingTime,
        noviceDwellingTime = _ref$noviceDwellingTi === void 0 ? 1000 / 3 : _ref$noviceDwellingTi,
        _ref$strokeColor = _ref.strokeColor,
        strokeColor = _ref$strokeColor === void 0 ? '#000' : _ref$strokeColor,
        _ref$strokeWidth = _ref.strokeWidth,
        strokeWidth = _ref$strokeWidth === void 0 ? 4 : _ref$strokeWidth,
        _ref$strokeStartPoint = _ref.strokeStartPointRadius,
        strokeStartPointRadius = _ref$strokeStartPoint === void 0 ? 8 : _ref$strokeStartPoint,
        _ref$lowerStrokeColor = _ref.lowerStrokeColor,
        lowerStrokeColor = _ref$lowerStrokeColor === void 0 ? '#777' : _ref$lowerStrokeColor,
        _ref$lowerStrokeWidth = _ref.lowerStrokeWidth,
        lowerStrokeWidth = _ref$lowerStrokeWidth === void 0 ? strokeWidth : _ref$lowerStrokeWidth,
        _ref$lowerStrokeStart = _ref.lowerStrokeStartPointRadius,
        lowerStrokeStartPointRadius = _ref$lowerStrokeStart === void 0 ? lowerStrokeWidth : _ref$lowerStrokeStart,
        _ref$gestureFeedbackD = _ref.gestureFeedbackDuration,
        gestureFeedbackDuration = _ref$gestureFeedbackD === void 0 ? 1000 : _ref$gestureFeedbackD,
        _ref$gestureFeedbackS = _ref.gestureFeedbackStrokeWidth,
        gestureFeedbackStrokeWidth = _ref$gestureFeedbackS === void 0 ? strokeWidth : _ref$gestureFeedbackS,
        _ref$gestureFeedbackC = _ref.gestureFeedbackCanceledStrokeColor,
        gestureFeedbackCanceledStrokeColor = _ref$gestureFeedbackC === void 0 ? '#DE6C52' : _ref$gestureFeedbackC,
        _ref$gestureFeedbackS2 = _ref.gestureFeedbackStrokeColor,
        gestureFeedbackStrokeColor = _ref$gestureFeedbackS2 === void 0 ? strokeColor : _ref$gestureFeedbackS2,
        _ref$notifySteps = _ref.notifySteps,
        notifySteps = _ref$notifySteps === void 0 ? false : _ref$notifySteps,
        _ref$log = _ref.log,
        log = _ref$log === void 0 ? {
      // eslint-disable-next-line no-console
      error: console.error && console.error.bind(console),
      // eslint-disable-next-line no-console
      info: console.info && console.info.bind(console),
      // eslint-disable-next-line no-console
      warn: console.warn && console.warn.bind(console),
      debug: function debug() {}
    } : _ref$log;

    // Create the display options
    var menuLayoutOptions = {};
    var strokeCanvasOptions = {
      lineColor: strokeColor,
      lineWidth: strokeWidth,
      pointRadius: strokeStartPointRadius
    };
    var lowerStrokeCanvasOptions = {
      lineColor: lowerStrokeColor,
      lineWidth: lowerStrokeWidth,
      pointRadius: lowerStrokeStartPointRadius
    };
    var gestureFeedbackOptions = {
      duration: gestureFeedbackDuration,
      strokeOptions: {
        lineColor: gestureFeedbackStrokeColor,
        lineWidth: gestureFeedbackStrokeWidth
      },
      canceledStrokeOptions: {
        lineColor: gestureFeedbackCanceledStrokeColor
      }
    }; // Create model and navigation observable.

    var model = createModel(items);
    var navigation$ = navigation(watchDrags(parentDOM), model, {
      minSelectionDist: minSelectionDist,
      minMenuSelectionDist: minMenuSelectionDist,
      subMenuOpeningDelay: subMenuOpeningDelay,
      movementsThreshold: movementsThreshold,
      noviceDwellingTime: noviceDwellingTime
    }).pipe(operators.tap(function (_ref2) {
      var originalEvent = _ref2.originalEvent;
      // Prevent default on every notifications.
      if (originalEvent) originalEvent.preventDefault();
    })); // Connect the engine's notifications to menu opening/closing.

    var connectedNavigation$ = connectLayout(parentDOM, navigation$, function (parent, menuModel, center, current) {
      return createMenu(parent, menuModel, center, current, menuLayoutOptions);
    }, function (parent) {
      return createStrokeCanvas(parent, strokeCanvasOptions);
    }, function (parent) {
      return createStrokeCanvas(parent, lowerStrokeCanvasOptions);
    }, function (parent) {
      return createGestureFeedback(parent, gestureFeedbackOptions);
    }, log); // If every steps should be notified, just export connectedNavigation$.

    if (notifySteps) {
      return connectedNavigation$.pipe(operators.map(exportNotification), operators.share());
    } // Else, return an observable on the selections.


    return connectedNavigation$.pipe(operators.filter(function (notification) {
      return notification.type === 'select';
    }), operators.pluck('selection'), operators.share());
  });

  return main;

})));
//# sourceMappingURL=marking-menu.js.map
