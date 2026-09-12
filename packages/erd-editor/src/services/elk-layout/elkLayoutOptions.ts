import type { LayoutOptions } from 'elkjs/lib/elk-api';

import { TablePlacement } from '@/constants/tablePlacement';

/** The placements ELK answers, which is every one but the force simulation. */
export type ElkPlacement = Exclude<TablePlacement, typeof TablePlacement.force>;

export function isElkPlacement(
  placement: TablePlacement
): placement is ElkPlacement {
  return placement !== TablePlacement.force;
}

/**
 * Whether ELK is handed a port per relationship endpoint rather than a bare
 * box. The layered placements ask only where a table goes; flow also says
 * where each connector meets it, which is what pulls the crossings out.
 */
export function usesPorts(placement: ElkPlacement): boolean {
  return placement === TablePlacement.flow;
}

/**
 * Whether the placement reads the coordinate hint a node can carry. Only the
 * views' preset layers and places interactively; the rest derive both from the
 * edges alone, and a hint sent with one of those would be paid for and ignored.
 */
export function usesCoordinateHints(placement: ElkPlacement): boolean {
  return placement === TablePlacement.liamLayered;
}

/**
 * Room left between two tables, between two layers of them, and between two
 * groups that share no relationship. A table is far wider than the boxes ELK's
 * own defaults were written for, so all three sit well above them.
 */
const NODE_SPACING = 80;

const LAYER_SPACING = 160;

const COMPONENT_SPACING = 160;

/**
 * What liam's own layout is told, copied option for option. The two
 * INTERACTIVE strategies are why a node carries a coordinate hint at all, and
 * the request normalizes that hint rather than reproducing what it measured.
 */
const LIAM_LAYERED: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.baseValue': '40',
  'elk.spacing.componentComponent': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '120',
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.mergeEdges': 'true',
  'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  'elk.layered.layering.strategy': 'INTERACTIVE',
};

/** Liam aligns a node to the left of its layer, which is the one node level option. */
const LIAM_NODE: LayoutOptions = { 'elk.alignment': 'LEFT' };

/**
 * The box the tables joined to nothing are gathered in, told what liam tells
 * its own and nothing besides: the ratio, under the layered algorithm around
 * it, which stands them in one column, as liam means it to. ELK places the box like any node.
 */
export const GROUP_NODE_OPTIONS: LayoutOptions = {
  'elk.aspectRatio': '0.5625',
};

const COMMON: LayoutOptions = {
  'elk.spacing.nodeNode': `${NODE_SPACING}`,
  // Tables joined to nothing are placed on their own and packed afterwards,
  // rather than drifting through a diagram they take no part in.
  'elk.separateConnectedComponents': 'true',
  'elk.spacing.componentComponent': `${COMPONENT_SPACING}`,
};

const layered = (direction: 'RIGHT' | 'DOWN'): LayoutOptions => ({
  ...COMMON,
  'elk.algorithm': 'layered',
  'elk.direction': direction,
  'elk.layered.spacing.nodeNodeBetweenLayers': `${LAYER_SPACING}`,
  // A foreign key pointing back at an ancestor is ordinary in a schema, and
  // layering wants an acyclic graph, so the edges to reverse are chosen by
  // walking the graph rather than by the cheaper count the default takes.
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
});

/**
 * What ELK is told, for the placement it was asked for.
 *
 * @example
 * const graph = { id: 'root', layoutOptions: elkLayoutOptions(placement) };
 */
export function elkLayoutOptions(placement: ElkPlacement): LayoutOptions {
  switch (placement) {
    case TablePlacement.layeredHorizontal:
      return layered('RIGHT');
    case TablePlacement.layeredVertical:
      return layered('DOWN');
    case TablePlacement.flow:
      return {
        ...layered('RIGHT'),
        // What makes a fan read as a fan: a node is centred over what it feeds
        // rather than pulled into the longest straight run its layer allows,
        // which is the default and leaves a branch point off to one side.
        'elk.layered.nodePlacement.strategy': 'SIMPLE',
        'elk.layered.spacing.edgeNodeBetweenLayers': `${NODE_SPACING}`,
      };
    case TablePlacement.liamLayered:
      return { ...LIAM_LAYERED };
  }
}

/**
 * What every node in a layout is told, before the ports a placement may add.
 * Only the views' preset says anything at this level, so the rest hand ELK a
 * bare box and let the algorithm's own defaults decide.
 *
 * @example
 * const layoutOptions = elkNodeLayoutOptions(placement);
 */
export function elkNodeLayoutOptions(
  placement: ElkPlacement
): LayoutOptions | null {
  return placement === TablePlacement.liamLayered ? { ...LIAM_NODE } : null;
}

/**
 * Every algorithm the placements name. ELK registers the metadata of these and
 * no others, so it is read off the options rather than listed: a placement
 * naming an algorithm left out here would be answered with an error.
 */
export const ELK_ALGORITHMS: string[] = [
  ...new Set(
    Object.values(TablePlacement)
      .filter(isElkPlacement)
      .map(placement => elkLayoutOptions(placement)['elk.algorithm'])
  ),
];
