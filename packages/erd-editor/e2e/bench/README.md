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
while idle. A trailing `!` means the drag came in *under* the idle floor, so the
difference is noise and the number in front of it means nothing.

It is not bracketed around the dispatch, and that is the whole point.
`relationshipSortHook` is a 5ms trailing throttle, so the relationship update
lands in a *later task* than the move that caused it. A probe that bracketed one
dispatch saw 8 attribute writes and zero relationship groups touched on the
large corpus — the routing work is simply not in that window.

**`util`** is `busy/move` as a share of one frame. Blocking on its own says
nothing about whether a drag holds 60fps; this is the number that does, and past
100% the frame is script-bound rather than compositing-bound.

**`frame p50` / `idle p50`** are animation-frame intervals with and without a
drag running. Idle is the floor; anything above it is the drag.

Each pass carries one instrument and no more, and the idle control it is
subtracted against carries the same one. The ping loop competes for the thread it
measures and stretches frames, so it stays out of the frame pass. The
`MutationObserver` behind `attr/move` costs time in proportion to how many
attributes the drag writes — which is exactly what a routing change moves — so it
stays out of the blocking pass; leaving it in charged the editor for the harness
watching it, by an amount that grew with the thing under test.

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

`node-cross` counts segment-against-table incidences, not connectors: a run split
into three by corner cuts is counted up to three times for the same table. It is
comparable within a run and across changes that leave the segment count alone, and
not across one that changes it.

`min pitch` is read from the document's anchors rather than from segment
endpoints. The routing polyline starts one stub away from the table, so no
segment end is an anchor; an earlier version scanned for segment ends that
happened to sit near a table box and reported whatever it found, including
nothing at all once stub lengths changed.

`collinear px` is how far two connectors run side by side within one stroke
width of each other — 3px, the width they are drawn at. It is a visual
complaint, so the threshold is the stroke and not equality. Pairs are compared
directly rather than bucketed: a band is not an equivalence relation, and
clustering chains 0-3-6-9 into one group.

## Comparing runs

`metricsVersion` in each report is bumped whenever a metric changes what it
*means* rather than what it measures, and deltas are suppressed across a bump.
Re-record the baseline after one. This exists because the opposite happened: a
baseline captured by an older harness kept printing percentages against numbers
that were no longer the same quantity, and every one of them was quoted as a
result.

Timings drift within a session by more than the effects worth resolving —
a five-run sequence on the large corpus fell monotonically from 8.5ms to 6.4ms
across changes that could not have caused it. **A performance claim needs the two
variants measured alternately, several rounds each, and reported as a
distribution.** The bounding-box prefilter below is the worked example: three
rounds of A/B put `large` at [6.37, 6.48, 6.76] against [7.61, 7.60, 7.61] —
non-overlapping, so real — while `small` gave [1.03, 1.50, 1.13] against
[1.13, 1.25, 1.24], which is nothing at all. A single sequential pair had
reported both as wins.

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

**Table penetration needed a router, and three cheaper attempts proved it.**
Scoring side pairs by obstacles is above. Flipping which axis the path leaves on
is worse everywhere — the existing heuristic already picks the good one, and the
alternative is 71% longer. Replacing the 45-degree middle segment with a plain
orthogonal elbow, which costs no extra segments, cuts node crossings 7-15% but
raised collinear overlap 783% *by the metrics v1 count*: parallel orthogonal
routes share a corridor where diagonals separate on their own. The direction of
that result is what mattered and it still holds — nudging belongs in the same
change as orthogonal routing — but the magnitude was measured by the definition
corrected in v2 and should not be quoted.

**What the router still gets wrong.** Node crossings are down 25-34% and the
picture reads far better; collinear overlap is the open problem, and every
figure quoted for it before metrics v2 was measured by a definition that could
only see two segments on the *identical* coordinate. Under the stroke-width band
the corpora hold 748 / 1329 / 8015 px of overlap, where the old count reported
0 / 0 / 2616. The router's own effect on it is no longer a number anyone has:
the pre-router diagonal was never measured this way.

**Collecting a channel the way a reader sees one, and scoring in pixels, took
two thirds of the overlap out.** The worst pair in every corpus was 2px apart —
`x=920` against `x=922` on small, `y=736` against `y=738` on medium, `y=1431`
against `y=1433` on large — which was `CHANNEL_EPSILON = 1` in `nudge.ts`
bucketing a channel by its coordinate rounded to the pixel: two segments 2px
apart landed in different buckets and were never considered for separation.
Collecting a channel by proximity instead took the corpora from 748 / 1329 / 8015
to 374 / 176 / 3532 px. Node crossings did not move (39 / 133 / 275 to
39 / 133 / 277) and total length rose 0.1%. Crossings between connectors rose — 3
to 5 and 77 to 79 for pairs sharing a table, 82 to 87 and 553 to 560 for
independent ones — which is what nudging costs: pulling two segments apart moves
one of them across whatever lies between.

**What the pass is scored on decided most of that.** Counting how many pairs of
segments an attempt leaves overlapping left large at 4504px; measuring how many
*pixels* they run together took it to 3081. The choices trade against each other
— clearing a 750px overlap is worth landing on a 16px one — and a count of pairs
cannot tell which way round to prefer. It is the question this file's
`collinearOverlap` asks, and aligning the two was the single largest step.

**Two guards cost overlap and are worth it.** A route may only leave its anchor
outward, which `routeOrthogonal` enforces when it enumerates candidates; keeping
that through a nudge costs large 3081 to 3532px and removes 9 connectors on that
corpus that folded back over their own turning point, 4 of them across the 35px
run the cardinality symbols are drawn on. Nothing else sees those: the fold stays
orthogonal, collapses nothing, and `countBlocked` skips the connector's own two
tables. Separately, a lane may not push the connector into either table it joins,
which `countBlocked` also cannot see for the same reason.

**What is left is three problems, and only one of them is this pass's.**
Splitting the metric by whether both segments are ones the pass may move puts
medium's whole 176px, and 1261px of large's, between runs attached to an anchor,
whose coordinate is the anchor's and not the route's. Small's 374px falls to zero
when the obstacle test in `isSafe` is disabled, at a cost of 3 node crossings, so
every lane its group could take runs into a table. The rest of large — 2271px
between interior segments, some of that obstacle-forced as well — is a group
spreading outward and landing within a stroke width of a segment in a channel it
was not grouped with.

**What it costs.** Measured alternately, three rounds each, `busy/move` ran
7.55 / 7.95 / 7.63 against 8.56 / 8.14 / 8.57 on large: non-overlapping, so a
real regression of roughly half a millisecond a move, 8% of the pass's frame
against a 16.7ms budget that still holds. Small came out 1.25 / 1.23 / 1.25
against 1.32 / 1.32 / 1.26 and medium 4.07 / 4.28 / 4.08 against
4.14 / 4.16 / 4.47, neither resolvable. The ladder is where it goes: three
separations by two orderings, each letting a segment try up to seven lanes, and
`countBlocked` walks every table. The quality figures were identical in every
round, which is the determinism the replication-store worker needs.

**Four things were tried and reverted.** A second separation round over the whole
drawing, which does see the overlaps the first pass creates, took large from 4504
to 7559px: what one group gains, the group it displaces loses. Scoring the runs
attached to an anchor as part of the objective cost 12%, and rejecting outright
any lane that lands on one cost 143% — they are neighbours a lane must weigh, not
a veto. And neither ordering of a bundle wins on its own: by where each route
arrives leaves large at 5486px, by where each segment already sits leaves it at
7332 and medium at 508 while clearing small outright, so both are tried and
scored.

**Cutting the corners at 45 degrees is a render pass and costs a tenth of a
millisecond a move.** The polyline the router and the nudge pass work on stays
orthogonal; only what reaches the screen is cut, so channels, obstacle tests and
the overlap metrics keep measuring right angles. Segments rise 72 / 228 / 452 to
101 / 375 / 751 — two per cut corner — and with them `node-cross` (39 / 133 / 277
to 52 / 196 / 385), which counts incidences and not connectors: the same run
through the same table, in three pieces. Total length falls 1.2% on the large
corpus, because a cut corner is shorter than the two legs it replaces, and
collinear overlap falls with it for the same reason. Measured alternately, three
rounds each, `busy/move` ran 1.31 / 1.35 / 1.35 against 1.49 / 1.46 / 1.45 on
small and 4.04 / 4.39 / 4.12 against 4.54 / 4.57 / 4.48 on medium — both
non-overlapping, so both real, at 8-9% — while large's 8.32 / 8.26 / 8.78 against
9.07 / 8.57 / 9.05 does not resolve. `frame p50` stayed at one vsync throughout.
Drawing a route as one `<path>` rather than a `<line>` per segment would take that
back, and would also make `node-cross` mean what it used to.

**The next lever is a channel-wide track assignment.** Runs are chained
components of the span-overlap relation, so a chain that only ever overlaps its
neighbour is still splayed across one lane each; colouring the channel as the
interval graph it is would clear the same overlaps with less displacement, and
displacement is what the extra crossings and the extra length are paid in. Two
cheaper cuts sit alongside it: a fifth of lane probes re-test a segment at a lane
already rejected in the same group's ladder, and band chaining leaves a group
unbounded — 30 slots on the large corpus where exact-coordinate bucketing reached
8.


Snapping channels to the nudge grid was tried and made the old count worse by
60%: it puts more routes on one coordinate than can be safely spaced apart.

**The router cannot get around a table directly between two aligned anchors.**
With both turning points on the same line, the channel template degenerates —
`[m, {x, y: m.y}, {x, y: l.y}, l]` with `m.y === l.y` is a straight line
whatever `x` is — and the escape template steps out by a fixed
`ROUTE_CLEARANCE` before turning, which lands inside the blocking table whenever
it is wider than 16px from the anchor. Every candidate is blocked, so the
cheapest blocked one wins and the connector is drawn straight through. Three
tables in a row, 361px wide, reproduce it. Offset the two ends and the router
bends around correctly, so this is a gap in the templates rather than in the
scoring.

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
