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

`node-cross` counts one connector through one table once, however many runs it is
drawn in. Until metrics v3 it counted segment-against-table incidences, so cutting
the corners of a route inflated it by a third with nothing having moved — a number
that rose whenever the drawing gained segments was useless for judging a change
that gains segments.

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
Re-record the baseline after one. v3 is `node-cross`: connector-table pairs, where
v2 counted segment-table incidences. This exists because the opposite happened: a
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
(Every `node-cross` figure in this paragraph and the next two is a metrics v1 or v2
quantity — segment-against-table incidences. Metrics v3 counts connector-table
pairs, so none of them is comparable with a run of the current harness.)
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

**What is left is two problems, and only one of them is this pass's.** Splitting
the metric by whether both segments are ones the pass may move puts medium's whole
168px, and 1121px of large's, between runs attached to an anchor — a connector's
first and last run, whose coordinate is the anchor's and not the route's, and which
nothing here can move. The other 1822px of large's is a group spreading outward and
landing within a stroke width of a segment in a channel it was not grouped with.
Small has none of either.

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
101 / 375 / 751, two per cut corner. `node-cross` rose with them at the time —
39 / 133 / 277 to 52 / 196 / 385, both metrics v2 quantities — because it counted
the same run through the same table three times over once the run was in three
pieces. That is what metrics v3 fixed; neither figure is comparable with what the
harness prints now. Total length falls 1.2% on the large
corpus, because a cut corner is shorter than the two legs it replaces, and
collinear overlap falls with it for the same reason. Measured alternately, three
rounds each, `busy/move` ran 1.31 / 1.35 / 1.35 against 1.49 / 1.46 / 1.45 on
small and 4.04 / 4.39 / 4.12 against 4.54 / 4.57 / 4.48 on medium — both
non-overlapping, so both real, at 8-9% — while large's 8.32 / 8.26 / 8.78 against
9.07 / 8.57 / 9.05 does not resolve. `frame p50` stayed at one vsync throughout.
Drawing a route as one `<path>` rather than a `<line>` per segment took that back
— see below. It did nothing for `node-cross`, which reads the geometry and not the
markup; that needed the metric itself changing.

**One `<path>` a connector, rather than a `<line>` a segment, paid the corner
cuts back with interest.** The geometry is untouched — every quality figure came
back byte-identical, which is what says the benchmark now reads the path's `d` as
faithfully as it read the lines — while attribute writes per move fell 187 / 241 /
350 to 116 / 136 / 217, a little under half. Measured alternately, three rounds
each, `busy/move` ran 1.48 / 1.45 / 1.52 against 1.29 / 1.27 / 1.18 on small,
4.55 / 4.62 / 4.39 against 3.96 / 4.14 / 4.21 on medium and
9.38 / 9.54 / 8.74 against 8.45 / 8.47 / 8.65 on large: non-overlapping in all
three, 8% to 15% faster, against the 8-9% the cuts had cost. Two things came with
it — the dash pattern now runs continuously through a corner instead of restarting
at each segment, and the element census in `e2e/specs/relationship.spec.ts` stopped
depending on how many runs a route is drawn in, which is what had broken it.

**Track assignment, and then how the layout is chosen, cleared the small corpus
outright.** A run is a chain of the span-overlap relation and not a clique, so
four segments that each only reach their neighbour were handed a lane each and
splayed over 30px, where two lanes clear every overlapping pair and move nobody
more than 5. Colouring the group as the interval graph it is — greedily, by where
each segment starts, which is optimal for intervals — gives that compact layout.

Three things had to be right about it. Sharing a lane needs a gap of clearance and
not a bare touch: two segments that meet end to end overlap by no *length*, so a
score in pixels called sharing a lane free, while their corners landed on the same
point and each one's arms continued the other's — one long connector crossing
another, neither of which was there. Imposing the compact layout made large worse,
3294 to 4305px, because a lane is also how a segment gets away from something
outside its group. And taking the first layout that clears the channel made the
order of a list the tie-break between two that both work.

Offering both layouts and taking whichever clears the channel *having moved the
group least* gives 0 / 168 / 2943px, with crossings back to where they were before
any of this work (3 / 16 / 81 same-table, 1 / 80 / 549 independent) and length 1.1%
shorter. Preferring the compact layout instead, on list position, reads
358 / 168 / 2685: better on the large corpus and worse everywhere else, including
small, which the least-movement rule clears completely — the obstacles that were
forcing that residual only forced it because the group was being moved further than
it needed to be. `busy/move` on large went 8.53 / 8.41 / 8.46 to 8.58 / 8.70 / 8.56
measured alternately, which resolves at 1.5%.

**Two cheaper cuts are what is left of the cost.** A fifth of lane probes re-test
a segment at a lane already rejected in the same group's ladder, and band chaining
leaves a group unbounded — 30 slots on the large corpus where exact-coordinate
bucketing reached 8, and nothing bounds what the ladder spends on one.


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
