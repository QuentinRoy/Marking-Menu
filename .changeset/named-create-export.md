---
'marking-menu': major
---

Replace the default `MarkingMenu` export with the named `createMarkingMenu`
export. Update imports and calls accordingly:

```js
import { createMarkingMenu } from 'marking-menu';

const menu$ = createMarkingMenu({ items, parent });
```
