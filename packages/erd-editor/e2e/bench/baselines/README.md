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

A file missing from this list has not been recorded yet. Recording it, and
recovering it if it is lost, is `../README.md` under "The DOM baseline".

The reports carry their own `label`, `createdAt`, `metricsVersion` and
`corpus`, so nothing about which run a file came from lives in its name.

`dom-scaling.json` is a later run than the other three. The first recording
asked for totals below what the generator can produce, so its two lowest rows
were the same 1000-relationship document measured twice; the sweep starts at
that floor now, and the file was re-measured on the same machine against the
same renderer once it did. Its four rows are four different documents — 1001,
1200, 1400 and 1600 relationships. The 1600 row is the check that the two runs
are comparable: `attr` came back identical, and `busy` and `frame` landed
within a percent.

The other three were not re-measured. Nothing about what they sweep changed.

Paths in `dom-screenshot.json` are relative to the repository root.
