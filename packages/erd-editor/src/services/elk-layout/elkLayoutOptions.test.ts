import { describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import {
  ELK_ALGORITHMS,
  elkLayoutOptions,
  elkNodeLayoutOptions,
  type ElkPlacement,
  GROUP_NODE_OPTIONS,
  isElkPlacement,
  usesCoordinateHints,
  usesPorts,
} from '@/services/elk-layout/elkLayoutOptions';

/** The placements the author picks from the menu, which the views' preset is not one of. */
const ELK_PLACEMENTS: ElkPlacement[] = [
  TablePlacement.layeredHorizontal,
  TablePlacement.layeredVertical,
  TablePlacement.flow,
];

/**
 * Section G of the spec, option for option, which is what the reference's own
 * getElkLayout tells ELK. Written out rather than imported, so a change to the
 * preset has to be made twice and reads as a deliberate departure from it.
 */
const VIEW_LAYOUT_OPTIONS = {
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

describe('isElkPlacement', () => {
  it('answers for every placement but the force simulation', () => {
    expect(isElkPlacement(TablePlacement.force)).toBe(false);

    for (const placement of ELK_PLACEMENTS) {
      expect(isElkPlacement(placement)).toBe(true);
    }
    expect(isElkPlacement(TablePlacement.viewLayered)).toBe(true);
  });

  // The lists above are written out, so this is what fails when a placement is
  // added and the specs below quietly stop covering it.
  it('names, with the views preset, every placement these specs cover', () => {
    expect([...ELK_PLACEMENTS, TablePlacement.viewLayered].sort()).toEqual(
      Object.values(TablePlacement).filter(isElkPlacement).sort()
    );
  });
});

// AC-21 and AC-32: Flow and Focus both place with this preset, so what the two
// of them ask ELK for is pinned once, here.
describe('elkLayoutOptions for the views preset', () => {
  it('tells ELK what the reference tells it, option for option and nothing besides', () => {
    expect(elkLayoutOptions(TablePlacement.viewLayered)).toEqual(
      VIEW_LAYOUT_OPTIONS
    );
  });

  it('gives a node its alignment, which is the one option at that level', () => {
    expect(elkNodeLayoutOptions(TablePlacement.viewLayered)).toEqual({
      'elk.alignment': 'LEFT',
    });
  });

  it('leaves the placements the author picks with no node option of their own', () => {
    for (const placement of ELK_PLACEMENTS) {
      expect(elkNodeLayoutOptions(placement)).toBeNull();
    }
  });

  it('joins table to table, so it asks for no port', () => {
    expect(usesPorts(TablePlacement.viewLayered)).toBe(false);
  });

  // Section G names the ratio and nothing else for the group; an algorithm
  // of its own would pack the column the reference stands these tables in.
  it('gathers the tables no relationship reaches at the ratio the reference gives the group, and nothing besides', () => {
    expect(GROUP_NODE_OPTIONS).toEqual({ 'elk.aspectRatio': '0.5625' });
  });

  it('is the one placement that reads a coordinate hint', () => {
    expect(usesCoordinateHints(TablePlacement.viewLayered)).toBe(true);

    for (const placement of ELK_PLACEMENTS) {
      expect(usesCoordinateHints(placement)).toBe(false);
    }
  });
});

describe('ELK_ALGORITHMS', () => {
  // Written out rather than derived from elkLayoutOptions, which is what the
  // list itself is derived from: a placement that starts naming another
  // algorithm has to be registered, and this is where that is noticed.
  it('names every algorithm a placement asks for, once each', () => {
    expect([...ELK_ALGORITHMS].sort()).toEqual(['layered']);

    for (const placement of [...ELK_PLACEMENTS, TablePlacement.viewLayered]) {
      expect(ELK_ALGORITHMS).toContain(
        elkLayoutOptions(placement)['elk.algorithm']
      );
    }
  });

  it('is what ELK is asked to register, so it can never be empty', () => {
    expect(ELK_ALGORITHMS.length).toBeGreaterThan(0);
  });
});

describe('usesPorts', () => {
  it('is flow alone, because it is the one that names where a connector lands', () => {
    expect(ELK_PLACEMENTS.filter(usesPorts)).toEqual([TablePlacement.flow]);
  });
});

describe('elkLayoutOptions', () => {
  it('names an algorithm and a direction for every placement it answers', () => {
    for (const placement of ELK_PLACEMENTS) {
      const options = elkLayoutOptions(placement);

      expect(options['elk.algorithm']).toBeTruthy();
      expect(options['elk.direction']).toBeTruthy();
    }
  });

  it('lays the two layered placements out along opposite axes', () => {
    const horizontal = elkLayoutOptions(TablePlacement.layeredHorizontal);
    const vertical = elkLayoutOptions(TablePlacement.layeredVertical);

    expect(horizontal['elk.algorithm']).toBe('layered');
    expect(vertical['elk.algorithm']).toBe('layered');
    expect(horizontal['elk.direction']).toBe('RIGHT');
    expect(vertical['elk.direction']).toBe('DOWN');
  });

  it('breaks cycles by walking the graph, because a schema has them', () => {
    for (const placement of [
      TablePlacement.layeredHorizontal,
      TablePlacement.layeredVertical,
    ] as const) {
      expect(
        elkLayoutOptions(placement)['elk.layered.cycleBreaking.strategy']
      ).toBe('DEPTH_FIRST');
    }
  });

  it('lays flow out left to right, like the layered placement it extends', () => {
    const options = elkLayoutOptions(TablePlacement.flow);

    expect(options['elk.algorithm']).toBe('layered');
    expect(options['elk.direction']).toBe('RIGHT');
  });

  it('leaves every placement more room than ELK would take by default', () => {
    for (const placement of ELK_PLACEMENTS) {
      const options = elkLayoutOptions(placement);

      expect(Number(options['elk.spacing.nodeNode'])).toBeGreaterThan(20);
      expect(Number(options['elk.spacing.componentComponent'])).toBeGreaterThan(
        20
      );
    }
  });

  it('lays a group joined to nothing out on its own', () => {
    for (const placement of ELK_PLACEMENTS) {
      expect(
        elkLayoutOptions(placement)['elk.separateConnectedComponents']
      ).toBe('true');
    }
  });

  it('centres a branch point over what it feeds, for flow alone', () => {
    const strategy = (placement: ElkPlacement) =>
      elkLayoutOptions(placement)['elk.layered.nodePlacement.strategy'];

    expect(strategy(TablePlacement.flow)).toBe('SIMPLE');
    expect(strategy(TablePlacement.layeredHorizontal)).toBeUndefined();
    expect(strategy(TablePlacement.layeredVertical)).toBeUndefined();
  });

  it('gives every option a string value, which is all ELK reads', () => {
    for (const placement of ELK_PLACEMENTS) {
      for (const value of Object.values(elkLayoutOptions(placement))) {
        expect(typeof value).toBe('string');
      }
    }
  });
});
