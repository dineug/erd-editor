# routing bench

Measures what a table drag costs and how much the relationship drawing
overlaps. It asserts nothing and runs in no CI job — a runner's noise floor is
wider than the differences it exists to resolve.

```bash
pnpm --filter @dineug/erd-editor e2e:bench                      # compare against the saved baseline
E2E_BENCH_LABEL=phase-3 pnpm --filter @dineug/erd-editor e2e:bench
E2E_BENCH_BASELINE=1 pnpm --filter @dineug/erd-editor e2e:bench # save this run as the baseline
E2E_BENCH_ALL=1 pnpm --filter @dineug/erd-editor e2e:bench      # include the diagnostics below
```

Results land in `e2e/.bench/` (gitignored). `baseline.json` is written only on
request, so a comparison is always against a baseline someone chose.

| File                   | What it is                                                     |
| ---------------------- | -------------------------------------------------------------- |
| `routing.bench.ts`     | The benchmark. The only file the default run executes           |
| `corpus.ts`            | Seeded generators at three scales, sized against `data/`        |
| `harness.ts`           | In-page measurement — drives the drag and times the pipeline    |
| `geometry.ts`          | Overlap metrics, computed from the segments actually drawn      |
| `attribution.bench.ts` | Diagnostic: which painter owns the frame                        |
| `scaling.bench.ts`     | Diagnostic: does cost track what changed, or what is on screen? |
| `screenshot.bench.ts`  | Renders three scenes to PNG — this repo has no other visual check |

## What the numbers mean

**`busy/move`** is main-thread blocking per mousemove, measured by a ping loop
that runs outside every task the editor owns, minus the same measurement taken
while idle.

It is not bracketed around the dispatch, and that is the whole point.
`relationshipSortHook` is a 5ms trailing throttle, so the relationship update
lands in a *later task* than the move that caused it. A probe that bracketed one
dispatch saw 8 attribute writes and zero relationship groups touched on the
large corpus — the routing work is simply not in that window.

**`frame p50` / `idle p50`** are animation-frame intervals with and without a
drag running. Idle is the floor; anything above it is the drag. These come from
a separate pass, because the ping loop that measures blocking competes for the
thread it is measuring and stretches frames under load.

**`attr/move`** is attribute mutations committed inside the canvas, and
**`fan-out`** is how many distinct relationships those mutations belong to.
Neither has any timing noise, which makes them the sharpest regression signals
here: a change claiming to cut render work has to move them.

**`flips/move`** counts how often a relationship changes which side of a table
it leaves from, over one drag. Side choice is remade from scratch on every
mousemove, so a table crossing the point where a different pair of sides becomes
marginally closer makes its connectors jump. No other metric can see that — the
drawing is equally valid before and after, and a jump costs no measurable time.
It has its own pass, because reading it means serialising the document every
frame.

**Quality** metrics are computed from the `<line>` elements the editor drew, not
from a recomputation of the geometry — a routing change that edits anchors but
never reaches the path still shows up. `cross-shared` and `cross-free` are kept
apart because different fixes move them: anchor ordering can drive crossings
between relationships that touch the same table to zero on its own, while
crossings between independent pairs only fall to side re-assignment. Summing
them hides which change did the work.

`min pitch` is read from the document's anchors rather than from segment
endpoints. The routing polyline starts one stub away from the table, so no
segment end is an anchor; an earlier version scanned for segment ends that
happened to sit near a table box and reported whatever it found, including
nothing at all once stub lengths changed.

## What the diagnostics found

All against 56 tables / 120 relationships.

**The frame was compositing, not script.** Blocking was around a millisecond
per move while the frame took fifty, against an idle floor of one vsync. Hiding
either the minimap or the canvas SVG — *either one alone* — restored 60fps. The
minimap holds a full-size copy of the canvas scaled to a thumbnail and shared a
compositing layer with it, so every table move invalidated both. `will-change:
transform` on `.minimap` fixed it outright: 50ms to 16.7ms, p95 100ms to 17ms,
blocking down 36%. `contain: strict` did nothing.

**Reducing what the minimap draws did nothing.** Rendering its relationships
without the cardinality decorations — invisible at that scale anyway — moved no
metric at all, before or after the layer fix. The cost was never the element
count. That change was reverted.

**Obstacle-aware side selection is the wrong lever.** Scoring the sixteen side
pairs by how many tables each route crosses cuts node crossings by up to half,
but only by taking long detours: at the penalty that buys −54% node crossings,
crossings between relationships rise 139–800% and total line length 24–46%.
Sweeping the penalty just trades one against the other. With the path fixed at
three segments the only way around a table is a different pair of sides; going
round properly needs the path to bend. That change was reverted too.

**Nothing cheap is left for table penetration.** Three attempts, all reverted.
Scoring side pairs by obstacles is above. Flipping which axis the path leaves on
is worse everywhere — the existing heuristic already picks the good one, and the
alternative is 71% longer. Replacing the 45-degree middle segment with a proper
orthogonal elbow — which costs no extra segments — cuts node crossings 7-15% but
raises collinear overlap 783%, because parallel orthogonal routes share a
corridor where diagonals separate naturally. That is the result the routing plan
predicted for orthogonal routing shipped without nudging.

**Side choice is stable enough.** `flips/move` is 0.05 at the largest corpus —
about six jumps over a 240px drag of a hub table. Hysteresis was considered and
is not worth its risk at that rate; the metric stays to catch a change that
makes it worse.

**Cost tracks the fan-out, not the document.** Holding tables and hub degree
fixed and varying only the total relationship count gives roughly
`2.4ms + 0.63ms × relationships redrawn`. Culling what is off-screen would only
touch the fixed term.

**Saturation was silently coalescing updates.** `attr/move` *rose* 13–47% when
the frame fix landed, and matches what the `no-minimap` variant already
reported. Under a blown frame budget the 5ms trailing throttle on
`relationshipSortHook` merged consecutive moves, so the relationship layer
lagged the tables it was drawn between. At 60fps every move lands.

## Adding a scenario

`CORPORA` in `corpus.ts` is the list. Keep the canvas size shared so SVG area
never confounds a comparison, and keep the seed fixed — the generator exists so
two runs are byte-identical, which `data/*.sql` cannot give.

`data/` is still the manual check. Import a real dump and look at it before
calling a routing change done; there is no visual regression test anywhere in
this repo.
