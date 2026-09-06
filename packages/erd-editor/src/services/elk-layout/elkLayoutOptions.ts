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
 * Room left between two tables, between two layers of them, and between two
 * groups that share no relationship. A table is far wider than the boxes ELK's
 * own defaults were written for, so all three sit well above them.
 */
const NODE_SPACING = 80;

const LAYER_SPACING = 160;

const COMPONENT_SPACING = 160;

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
 * What ELK is told, for the placement the author picked.
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
  }
}
