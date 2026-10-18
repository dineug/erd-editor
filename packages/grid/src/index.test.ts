import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import type * as font from '@/font';
import * as grid from '@/Grid';
import type {
  CellChange,
  CellContextMenuEvent,
  CellGetter,
  CellRange,
  CellRef,
  CellStyle,
  CellStyleGetter,
  CloseReason,
  ColumnDef,
  ColumnResize,
  CommitEvent,
  EditMode,
  EditorContext,
  FontMetrics,
  GridBounds,
  GridColumn,
  GridHandle,
  GridProps,
  GridSelection,
  GridTheme,
  RejectEvent,
  SceneData,
  SceneInit,
  SceneLayout,
  SceneRect,
  SceneState,
  ViewportChange,
  VisibleRange,
} from '@/index';
import * as entry from '@/index';
import type * as editing from '@/model/editing';
import type * as model from '@/model/types';
import type * as viewport from '@/model/viewport';
import type * as cells from '@/scene/draw/cells';
import type * as layout from '@/scene/layout';
import type * as scene from '@/scene/state';
import * as theme from '@/theme';

describe('the package entry', () => {
  it('exposes the component and the two default themes, and nothing else at runtime', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'Grid',
      'darkTheme',
      'lightTheme',
    ]);
  });

  it('re-exports the modules a host would otherwise reach into', () => {
    expect(entry.Grid).toBe(grid.Grid);
    expect(entry.Grid).toBe(grid.default);
    expect(entry.lightTheme).toBe(theme.lightTheme);
    expect(entry.darkTheme).toBe(theme.darkTheme);
  });

  it('names the component types a host mounts the grid with', () => {
    expectTypeOf<GridProps>().toEqualTypeOf<grid.GridProps>();
    expectTypeOf<GridColumn>().toEqualTypeOf<grid.GridColumn>();
    expectTypeOf<GridHandle>().toEqualTypeOf<grid.GridHandle>();
    expectTypeOf<CommitEvent>().toEqualTypeOf<grid.CommitEvent>();
    expectTypeOf<EditorContext>().toEqualTypeOf<grid.EditorContext>();
  });

  it('names the types the callbacks and the editor context hand a host', () => {
    expectTypeOf<RejectEvent>().toEqualTypeOf<grid.RejectEvent>();
    expectTypeOf<ViewportChange>().toEqualTypeOf<grid.ViewportChange>();
    expectTypeOf<CellContextMenuEvent>().toEqualTypeOf<grid.CellContextMenuEvent>();
    expectTypeOf<CellChange>().toEqualTypeOf<editing.CellChange>();
    expectTypeOf<CommitEvent['changes'][number]>().toEqualTypeOf<CellChange>();
    expectTypeOf<CloseReason>().toEqualTypeOf<editing.CloseReason>();
    expectTypeOf<EditMode>().toEqualTypeOf<EditorContext['mode']>();
    expectTypeOf<
      Parameters<NonNullable<GridProps['onReject']>>[0]
    >().toEqualTypeOf<RejectEvent>();
    expectTypeOf<
      Parameters<NonNullable<GridProps['onViewportChange']>>[0]
    >().toEqualTypeOf<ViewportChange>();
    expectTypeOf<
      Parameters<NonNullable<GridProps['onCellContextMenu']>>[0]
    >().toEqualTypeOf<CellContextMenuEvent>();
    expectTypeOf<
      Parameters<Parameters<EditorContext['onClose']>[0]>[0]
    >().toEqualTypeOf<CloseReason>();
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
