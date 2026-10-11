# committed baselines

`e2e/.bench/` is gitignored, which is right for a number anyone can produce
again by running the bench. These are the ones nobody can: results measured
against a renderer the working tree no longer has.

| File                   | Copied from                          |
| ---------------------- | ------------------------------------ |
| `dom-routing.json`     | `e2e/.bench/latest.json`             |
| `dom-attribution.json` | `e2e/.bench/attribution.latest.json` |
| `dom-scaling.json`     | `e2e/.bench/scaling.latest.json`     |
| `dom-screenshot.json`  | `e2e/.bench/screenshot.latest.json`  |

No other file will join this list. The two benches that write a report and
have no file here, `view.bench.ts` and `visualization-shots.bench.ts`, arrived
in 717b1e94 (2026-09-14) with the Flow mode of the Visualization tab, after
e9c9edfe (2026-09-04) replaced the DOM scene, so they have no DOM run to record.

A lost file comes back from git, since all four landed in e9c9edfe. From the
repository root, run
`git restore --source=HEAD --staged --worktree -- packages/erd-editor/e2e/bench/baselines/<file>`,
or `--source=e9c9edfe` once the deletion is committed. It cannot be measured
again with `../README.md` under "The DOM baseline": 4b7d242b moved the
`baseCommit` that procedure checks out to d58585ea, a Konva-era commit outside
`main`'s history, and laying the current bench over the DOM revision, 3a524e6e,
fails as well, because `harness.ts` grips tables on a Konva stage and throws
`konva stage "canvas" is not registered` without one.

The reports carry their own `label`, `createdAt` and `metricsVersion`; the
three single-corpus reports also carry `corpus`, while `dom-routing.json`,
which holds four corpora, names one on each row instead. So nothing about which
run a file came from lives in its name.

`dom-scaling.json` is a later run than the other three. The first recording
asked for totals below what the generator can produce, so its two lowest rows
were the same 1000-relationship document measured twice; the sweep starts at
that floor now, and the file was re-measured on the same machine against the
same renderer once it did, on 2026-08-30 by its `createdAt`. Its four rows are
four different documents — 1001, 1200, 1400 and 1600 relationships. The 1600
row is the check that the two runs are comparable: `attr` came back identical,
and `busy` and `frame` landed within a percent.

The other three were not re-measured. Nothing about what they swept changed
when the scaling sweep moved to that floor. The benches have moved on since.
`routing.bench.ts` now also walks `x150` and `x400`, which `dom-routing.json`
has no rows for, and gives each row an `onScreen` read beside `quality`. Write
counts are Konva attr writes rather than DOM attribute mutations, as
`../README.md` describes under "The konva port", and the attribution and
scaling rows store theirs as `sceneWritesPerMove` and `writes` where
`dom-attribution.json` and `dom-scaling.json` have `attrPerMove` and `attr`.
The variants of `attribution.bench.ts` changed as its "Variants" subsection
describes.

Paths in `dom-screenshot.json` are relative to the repository root and point
into the gitignored `e2e/.bench/shots/`. The PNGs were never committed, so only
the rows that describe them survive.
