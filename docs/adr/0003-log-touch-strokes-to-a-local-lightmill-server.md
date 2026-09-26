# Log touch strokes to a local Lightmill server

The touch stroke collector runs from a temporary branch in a tablet browser over local HTTP and uses Lightmill to write each completed trial to SQLite on the laptop before advancing. Browser storage alone can be evicted between recording days, and local HTTPS would require certificate or tunnel setup. Lightmill handles run resumption; the laptop database is backed up after each session, and a separate export produces the corpus files. The collector uses Lightmill's React experiment flow and never runs the marking menu recognizer.
