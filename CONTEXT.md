# Marking Menu

A radial menu selected by drawing directional marks. Novices pause to see the menu; experts draw the mark without it.

## Language

### Menu shape

**Level**:
The set of sibling items shown together in one ring: the root items, or the sub-items of one item.
_Avoid_: Layer, ring (for the concept)

**Breadth**:
The number of items in a level.
_Avoid_: Width, size

**Depth**:
The number of levels a selection passes through, from the root to the selected item.
_Avoid_: Height, nesting

**Single-level menu**:
A menu whose root items are all leaves, so every selection has a depth of one.
_Avoid_: Flat menu

**Gap**:
The angle between two neighboring items of a level, including the gap between the last and the first.
_Avoid_: Spacing, angle step

### Input

**Stroke**:
The points drawn by one press-move-release of the pointer, as given to the recognizer.
_Avoid_: Gesture (for the points), path

**Mark**:
The ideal shape that selects an item: one straight move per level, each in its item's direction.
_Avoid_: Gesture (for the shape)


### Recognition

**Correct selection**:
A stroke recognized as the item the user aimed for.

**Wrong selection**:
A stroke recognized as an item other than the one the user aimed for. Worse than a no selection, because the user may not notice it.
_Avoid_: Misrecognition (ambiguous with no selection)

**No selection**:
A stroke the recognizer rejects, selecting nothing.
_Avoid_: Cancel, miss


**Floor**:
The narrowest gap the library accepts for a menu of a given depth, set by where the recognizer stops meeting the reliability bar. Below it, the library rejects the menu.
_Avoid_: Limit (ambiguous with the documented human-accuracy limits), minimum angle
