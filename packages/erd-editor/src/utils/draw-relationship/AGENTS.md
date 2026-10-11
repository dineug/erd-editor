<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# draw-relationship

## Purpose

`src/utils/draw-relationship/` holds the geometry of every relationship connector: the sort pass that places its ends and routes it, the sort channels that keep a view's geometry apart from the document's, the corners, the self loops and the path a connector draws. This file also holds the rules of the connector drawing that depends on that geometry (the referential action label, the end markers) and of the sort hooks in `src/engine/modules/relationship/hooks.ts`. `src/components/AGENTS.md` says which `GeometrySource` a scene passes. `src/components/erd/AGENTS.md` holds the rest of the scene, `Show.hideTableGroup` and `Show.hideMemo` included.

## Key Files

| File | Description |
| --- | --- |
| `sort.ts` | `relationshipSort`, the whole geometry pass, routing included; `placeLoops` |
| `route.ts`, `nudge.ts` | The router and the nudge pass, run inside the sort pass |
| `pathFinding.ts` | `getRelationshipPath`: the path a connector draws, built from the anchors, stub slots and route the sort wrote. It places no end and routes nothing |
| `index.ts` | The `WeakMap` sort channels, `setAnchors`, `clearSortChannel`, `viewVersions`, the marker sizes (`LINE_SIZE`, `LINE_HEIGHT`, `CIRCLE_RADIUS`), the stub lengths, `ROUTE_CORNER_RADIUS` |
| `corner.ts` | Flattens a document corner to `ROUTE_CORNER_SEGMENTS` chords |
| `bezier.ts` | A view's curve, flattened the same way |
| `loop.ts` | A self loop's curve; `loopReach` |
| `src/utils/referentialAction.ts` | The referential action codes `C`, `R`, `SN`, `SD`, `NA` |
| `src/components/erd/canvas/relationship-group/RelationshipGroup.tsx` | Draws every referential action label after every route |
| `src/components/erd/canvas/relationship-group/relationship/RelationshipActionLabel.tsx` | The referential action label at a connector's child end |
| `src/components/erd/canvas/relationship-group/relationship/Relationship.tsx` | A connector; sets the stage container's `title` while the pointer is on it |
| `src/engine/modules/relationship/hooks.ts` | The sort hooks; `isPaintOnlyToggle` |

## Rules

### Sort pass and channels

- **`sort.ts` is the whole geometry pass.** Routing (`route.ts`, `nudge.ts`) belongs to it, because routing needs every table and every route. `pathFinding.ts` only draws.
- **A rendering-only value goes in a sort channel.** Put it in the `WeakMap` sort channels of `index.ts`, never a new schema field. Anchors are schema fields, which the runtime value (`toJson`) carries, though the file form (`toDocumentJson`) leaves them out and every store derives them again, on a load in `settleDocument` and after an edit in the sort hooks.
- **One channel per source.** A view keeps its anchors in its own channel, so `setAnchors` writes the entity only for the document. The document's sort and a view's then never read each other's routes.
- **Clear a sort channel per connector.** `clearSortChannel` clears the connectors it is given, never a whole channel, since channels are module-wide and a page may host two stores.
- **Bump `viewVersions` only on an actual change.** A view channel setter bumps a connector's version only when its value changed. An unconditional bump redraws every static connector on each drag sort.
- Which `GeometrySource` a function or scene passes, and where a scene root provides it: `src/components/AGENTS.md`.

### Referential action labels

- **Referential actions show at the child end.** `RelationshipActionLabel.tsx` draws them after erwin's notation, an owner decision (2026-10-03). It writes `D:` for ON DELETE, then `U:` for ON UPDATE, each only when set. The codes are `C`, `R`, `SN`, `SD` and `NA` (`src/utils/referentialAction.ts`).
- **The label takes the route's colour and hover.** It is set in the code face and the route's colour, and lights with the route on hover. The hover comes from the group's `hovered`, which only the labels read, and from `hoverRelationshipMap`.
- **The label box clears the widest marker.** The box has the canvas colour. It sits over a route that leaves sideways, reaching away from the table, and to the right of one that leaves up or down.
- **`RelationshipGroup` draws every label after every route.** So a connector that crosses a label runs under its box. Drawn inside each connector's own group, a label lay under every connector drawn after it.
- **Size the box from the advance.** The box is sized from the code face's advance, `0.61` of the size, as the alternate key marks are, so the text is never measured.
- **The label is the document's notation alone.** A view draws no distinction by kind. A zoom that draws a table by its name alone (`isHighLevelTable`) draws no label.
- **A hover spells the clauses out.** The canvas's native tooltip shows them: the `title` the stage container takes while the pointer is on the connector (`Relationship.tsx`), as the toolbar's buttons name themselves.
  - The `title` is written again on each render, so a peer's change under a resting pointer shows.
  - The tooltip shows with the label hidden too, and leaves with the pointer or the connector.
- **View Option's Referential Actions hides the label.** It sets `Show.hideReferentialAction`, one of the three bits that hide what they name; `hideTableGroup` and `hideMemo` are the others. So every document, those saved before the bit included, shows the labels until a reader turns them off.
- **Showing or hiding the labels moves nothing.** So the sort hook skips that toggle (`isPaintOnlyToggle`, which skips the group and memo bits too), and the table size key masks all three out.

### Connector ends and corners

- **Connector ends are compact and corners round.** These are owner decisions of 2026-10-10, issue #468.
  - The cardinality markers are 85% of their first size: `LINE_SIZE` 6, `LINE_HEIGHT` 9, `CIRCLE_RADIUS` 5, and the guide line from 21px. That is the size Workbench and Liam ERD draw them at.
  - A side's stubs run 24/32/40/48 with a floor of 24 (`index.ts`). So two facing tables about 50px apart join in one straight run; narrow tables shown by name alone sit that far apart.
  - Every connector draws its markers; an option to hide them was left out.
  - A document corner turns on a quarter circle of `ROUTE_CORNER_RADIUS`, flattened to `ROUTE_CORNER_SEGMENTS` chords (`corner.ts`) as a view's curve is (`bezier.ts`). So the hit path, the route box and the bench still read straight segments. The router and the nudge pass keep working on the orthogonal polyline.
  - A self loop is one curve round the table's top-right corner (`loop.ts`). Its anchors sit 20px from the corner on every table and 18px further for each further loop. They sit closer together where the shorter side has no room (`placeLoops`).
  - A self loop's stubs and control points scale with that offset, so a table's loops are one shape at nested sizes that never cross or touch the table. The route box reaches its curve (`loopReach`).
- **A label may hide a run's end.** A child end's referential action label can hide up to 14px of a run that turns into the end from the label's side, now that the stub ends inside the label's width. Accepting that over moving the label or lengthening those stubs is an owner decision (2026-10-10). The same holds for a loop's label: it can cover its own curve and, on a table with several loops, the end markers of the loop inside it.

### Sort hooks

- **Drags sort in a 5 ms window.** The sort hooks (`src/engine/modules/relationship/hooks.ts`) open a 5 ms window for a `Tag.drag` action and sort in a microtask otherwise. A timer would lose to the next frame, which draws moved tables with stale connectors.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
