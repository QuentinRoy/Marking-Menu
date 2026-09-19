---
'marking-menu': patch
---

Fix `divideLongestSegment` to divide the longest segment when it leads by any amount. A segment that led by one pixel or less used to lose to an earlier segment.
