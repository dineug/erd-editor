import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import type * as font from '@/font';
import type {
  CellGetter,
  CellRange,
  CellRef,
  CellStyle,
  CellStyleGetter,
  ColumnDef,
  ColumnResize,
  FontMetrics,
  GridBounds,
  GridSelection,
  GridTheme,
  SceneData,
  SceneInit,
  SceneLayout,
  SceneRect,
  SceneState,
  VisibleRange,
} from '@/index';
import * as entry from '@/index';
import type * as model from '@/model/types';
import type * as viewport from '@/model/viewport';
import type * as cells from '@/scene/draw/cells';
import type * as layout from '@/scene/layout';
import type * as scene from '@/scene/state';
import * as theme from '@/theme';

describe('the package entry', () => {
  it('exposes the two default themes, and nothing else at runtime', () => {
    expect(Object.keys(entry).sort()).toEqual(['darkTheme', 'lightTheme']);
  });

  it('re-exports the modules a host would otherwise reach into', () => {
    expect(entry.lightTheme).toBe(theme.lightTheme);
    expect(entry.darkTheme).toBe(theme.darkTheme);
  });

  it('names the model, theme and font types a host builds its props from', () => {
    expectTypeOf<CellRef>().toEqualTypeOf<model.CellRef>();
    expectTypeOf<CellRange>().toEqualTypeOf<model.CellRange>();
    expectTypeOf<GridSelection>().toEqualTypeOf<model.GridSelection>();
    expectTypeOf<GridBounds>().toEqualTypeOf<model.GridBounds>();
    expectTypeOf<CellStyle>().toEqualTypeOf<model.CellStyle>();
    expectTypeOf<ColumnDef>().toEqualTypeOf<model.ColumnDef>();
    expectTypeOf<VisibleRange>().toEqualTypeOf<viewport.VisibleRange>();
    expectTypeOf<GridTheme>().toEqualTypeOf<theme.GridTheme>();
    expectTypeOf<FontMetrics>().toEqualTypeOf<font.FontMetrics>();
  });

  it('names the scene types its state and layout are read through', () => {
    expectTypeOf<CellGetter>().toEqualTypeOf<cells.CellGetter>();
    expectTypeOf<CellStyleGetter>().toEqualTypeOf<cells.CellStyleGetter>();
    expectTypeOf<SceneLayout>().toEqualTypeOf<layout.SceneLayout>();
    expectTypeOf<SceneRect>().toEqualTypeOf<layout.SceneRect>();
    expectTypeOf<ColumnResize>().toEqualTypeOf<scene.ColumnResize>();
    expectTypeOf<SceneData>().toEqualTypeOf<scene.SceneData>();
    expectTypeOf<SceneInit>().toEqualTypeOf<scene.SceneInit>();
    expectTypeOf<SceneState>().toEqualTypeOf<scene.SceneState>();
  });
});
