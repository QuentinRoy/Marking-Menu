---
'marking-menu': patch
---

pr: #233
commit: ab83b8bede215758236a79640d956dfa8b80470e

After a gesture switches from expert to novice mode, events report `mode: 'novice'` instead of `undefined`.
