import { describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import {
  elkLayoutOptions,
  type ElkPlacement,
  isElkPlacement,
  usesPorts,
} from '@/services/elk-layout/elkLayoutOptions';

const ELK_PLACEMENTS: ElkPlacement[] = [
  TablePlacement.layeredHorizontal,
  TablePlacement.layeredVertical,
  TablePlacement.flow,
];

describe('isElkPlacement', () => {
  it('answers for every placement but the force simulation', () => {
    expect(isElkPlacement(TablePlacement.force)).toBe(false);

    for (const placement of ELK_PLACEMENTS) {
      expect(isElkPlacement(placement)).toBe(true);
    }
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
