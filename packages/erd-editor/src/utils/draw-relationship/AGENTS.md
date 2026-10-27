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
| `search.ts` | `searchRoute`: the way round a table for a route every candidate of the router takes through one |
| `pathFinding.ts` | `getRelationshipPath`: the path a connector draws, built from the anchors, stub slots and route the sort wrote. It places no end and routes nothing |
| `index.ts` | The `WeakMap` sort channels, `setAnchors`, `clearSortChannel`, `viewVersions`, the route versions and their drag hold (`holdRouteRedraws`), the marker sizes (`LINE_SIZE`, `LINE_HEIGHT`, `CIRCLE_RADIUS`), the stub lengths, `ROUTE_CORNER_RADIUS` |
| `corner.ts` | Flattens a document corner to `ROUTE_CORNER_SEGMENTS` chords |
| `bezier.ts` | A view's curve, flattened the same way |
| `loop.ts` | A self loop's curve; `loopReach` |
| `src/utils/referentialAction.ts` | The referential action codes `C`, `R`, `SN`, `SD`, `NA` |
| `src/components/erd/canvas/relationship-group/RelationshipGroup.tsx` | Draws every referential action label after every route |
| `src/components/erd/canvas/relationship-group/relationship/RelationshipActionLabel.tsx` | The referential action label at a connector's child end |
| `src/components/erd/canvas/relationship-group/relationship/Relationship.tsx` | A connector; sets the stage container's `title` while the pointer is on it |
| `src/engine/modules/relationship/hooks.ts` | The sort hooks; `isPaintOnlyToggle`, `reachesLayout` |

## Rules

### Sort pass and channels

- **`sort.ts` is the whole geometry pass.** Routing (`route.ts`, `nudge.ts`) belongs to it, because routing needs every table and every route. `pathFinding.ts` only draws.
- **A rendering-only value goes in a sort channel.** Put it in the `WeakMap` sort channels of `index.ts`, never a new schema field. Anchors are schema fields, which the runtime value (`toJson`) carries, though the file form (`toDocumentJson`) leaves them out and every store derives them again, on a load in `settleDocument` and after an edit in the sort hooks.
- **A document connector leaves sides whose stubs can meet.** Its sides are the nearest of the sixteen side-midpoint pairs whose shortest stubs face each other, each ahead of the other's side (`getAndSetDirection`). Where no pair's do, as for two tables standing closer than two stubs with no side clear of the other, it keeps the nearest pair. A view keeps the nearest pair, since its curve needs no corner.
  - Two facing tables about 50px apart still join in one straight run, and two aligned closer than that keep their facing sides, since no other pair faces.
- **A route the candidates cannot get past a table searches a way round.** The router scores a few candidates of up to four bends. When every one passes through a table, `searchRoute` looks for the cheapest route through no table, the two it joins included, on the lanes a clearance from the tables within `SEARCH_MARGIN` of the box the two turning points span, scored as the candidates are. It gives up past `MAX_SEARCH_POINTS` lane crossings, or where a turning point lies inside a table, and the blocked candidate stays.
  - The search may turn at a turning point and arrive at one from the side, never back along or across a stub: that is how it gets out between tables standing close.
  - Its answer depends on every table in the box it searched, so the route cache keeps that box for the route (`RouteResult.reach`).
  - Measured 2026-10-27 on `data/test.json` (59 routed connectors): 13 runs pass through a third table, and a drag sort's median is 0.9 ms; on a 20 x 20 grid of tables with 600 relationships it is 10.1 ms. The search runs only for the connectors whose candidates are all blocked, about ten a drag step on either.
- **One channel per source.** A view keeps its anchors in its own channel, so `setAnchors` writes the entity only for the document. The document's sort and a view's then never read each other's routes.
- **Clear a sort channel per connector.** `clearSortChannel` clears the connectors it is given, never a whole channel, since channels are module-wide and a page may host two stores.
- **Bump `viewVersions` only on an actual change.** A view channel setter bumps a connector's version only when its value changed. An unconditional bump redraws every static connector on each drag sort.
- **A document route redraws its connector when it alone changes.** The entity's proxy redraws a connector whose anchors moved; a route a moved table pushed aside has its own version, bumped by `setRoute` when the route changed by 0.01 or more.
  - The version is made by the first render that reads the route (`getRoute`), never by a sort. A peer's or a replica's store draws nothing and has no `Node`, where an r-html observable throws as it is read (`sort.domFree.test.ts`).
  - A drag of the document holds these redraws back (`beginEntityDrag` calls `holdRouteRedraws`, `endEntityDrag` calls `releaseRouteRedraws`) and redraws each held connector once at the drop. The drag draws what it moves on layers of its own, and a static connector redrawn each frame would repaint the layer every static table sits in. So while the drag runs, a static connector keeps the route it had as the drag began.
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
  - The loops reserve the top side's far end and the right side's near end for themselves, `SELF_CLEARANCE` past the outermost loop. A side that reserve leaves too short for its anchors to sit `SQUEEZED_PITCH` apart gives up its inset at the loops' end, then at its other end, and its anchors never pass its edge. A Flow card drawn by its name alone is that short.
- **A label may hide a run's end.** A child end's referential action label can hide up to 14px of a run that turns into the end from the label's side, now that the stub ends inside the label's width. Accepting that over moving the label or lengthening those stubs is an owner decision (2026-10-10). The same holds for a loop's label: it can cover its own curve and, on a table with several loops, the end markers of the loop inside it.

### Sort hooks

- **Drags sort in a 5 ms window.** The sort hooks (`src/engine/modules/relationship/hooks.ts`) open a 5 ms window for a `Tag.drag` action and sort in a microtask otherwise. A timer would lose to the next frame, which draws moved tables with stale connectors.
- **A store that draws nothing routes no connector.** The document's sort hook still places the anchors, and passes `route: false` where the `EngineContext` says `routes: false`, a peer's or a replica's, as their load does (`src/engine/AGENTS.md`, `settleDocument`). Only a drawing and the image export read a route. A comment edit on a table 400 others refer to routed every connector in `mcp-server`'s peer, 107 ms of the 129 ms its sort took (measured 2026-10-25).
- **Only a domain's name moves a table among the dictionary writes.** Both hooks' filters run `reachesLayout`: a `dictionary.add` or `remove` of a domain, or an `update` whose `values` carry a domain's `name`, passes, and so does a lock change only as an unlock of the name view, and a name view switch only where the store shows it, shared or its own. A word or term commit, a domain's type alone, which reaches the columns through `column.changeDataType`, or another reader's own switch neither bumps the width generation nor sorts (`hooks.test.ts`). A view sorts for a switch and an unlock too, and outside the physical view, which draws neither, for a domain renamed and for a logical name or a domain link on a table it shows (`isNameViewOnly`, `hooks.view.test.ts`). The name views: `src/components/erd/AGENTS.md`, Name views.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
