import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg } from '@/agent/registry';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  changeMemoColorAction,
  changeMemoValueAction,
  moveToMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addMemoAction$,
  removeMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import type { Collections } from '@/internal-types';

const MEMO_ID: ToolArg = {
  name: 'memoId',
  kind: { type: 'entityId', entity: 'memo' },
  required: true,
};

const numberArg = (name: string): ToolArg => ({
  name,
  kind: { type: 'number' },
  required: true,
});

const memoPath = (...fields: string[]) =>
  fields.map(field => `memos[memoId].${field}`);

const memoOf = (collections: Collections, id: string) =>
  query(collections).collection('memoEntities').selectById(id);

/** The stream handler needs the color it replaces, which only the state knows. */
const changeMemoColorAction$ = (id: string, color: string): GeneratorAction =>
  function* ({ collections }) {
    yield changeMemoColorAction({
      id,
      color,
      prevColor: memoOf(collections, id)?.ui.color ?? '',
    });
  };

/** Resizes from the memo's corner, where it stands, as the far edge handles do. */
const resizeMemoAction$ = (
  id: string,
  width: number,
  height: number
): GeneratorAction =>
  function* ({ collections }) {
    const memo = memoOf(collections, id);
    if (!memo) return;

    yield resizeMemoAction({ id, x: memo.ui.x, y: memo.ui.y, width, height });
  };

export const memoTools: readonly ActionTool[] = [
  {
    name: 'erd_add_memo',
    kind: 'generator',
    actionTypes: ['memo.add'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['memos'],
    args: [],
    toActions: () => [addMemoAction$()],
  },
  {
    name: 'erd_remove_memo',
    kind: 'generator',
    actionTypes: ['memo.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['memos'],
    args: [MEMO_ID],
    toActions: ({ memoId }) => [removeMemoAction$(memoId)],
  },
  {
    name: 'erd_change_memo_value',
    kind: 'atom',
    atomReason:
      'The memo module has no generator that edits a memo text; the memo text area dispatches this atom itself.',
    actionTypes: ['memo.changeValue'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: memoPath('value'),
    args: [
      MEMO_ID,
      { name: 'value', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ memoId, value }) => [
      changeMemoValueAction({ id: memoId, value }),
    ],
  },
  {
    name: 'erd_change_memo_color',
    kind: 'atom',
    atomReason:
      'No generator colors one named memo: changeColorAllAction$ colors the selection. The tool reads the previous color from the state as that generator does.',
    actionTypes: ['memo.changeColor'],
    undoable: true,
    stream: true,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: memoPath('color'),
    args: [
      MEMO_ID,
      { name: 'color', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ memoId, color }) => [changeMemoColorAction$(memoId, color)],
  },
  {
    name: 'erd_move_memo',
    kind: 'atom',
    atomReason:
      'No generator places one memo at a point: moveAllAction$ drags the selection by a relative step.',
    actionTypes: ['memo.moveTo'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: memoPath('x', 'y'),
    args: [MEMO_ID, numberArg('x'), numberArg('y')],
    toActions: ({ memoId, x, y }) => [moveToMemoAction({ id: memoId, x, y })],
  },
  {
    name: 'erd_resize_memo',
    kind: 'atom',
    atomReason:
      'The memo module has no generator that resizes a memo; the resize handles stream this atom themselves.',
    actionTypes: ['memo.resize'],
    undoable: false,
    undoableReason:
      'memo/history.ts turns a resize into an undo entry only from two or more resize actions of one memo in one stream group, and a call sends one.',
    stream: true,
    expectedBatches: 1,
    expectedHistory: 0,
    snapshotPaths: memoPath('width', 'height'),
    args: [MEMO_ID, numberArg('width'), numberArg('height')],
    refine: ({ width, height }) =>
      width < MEMO_MIN_WIDTH || height < MEMO_MIN_HEIGHT
        ? `width must be at least ${MEMO_MIN_WIDTH} and height at least ${MEMO_MIN_HEIGHT}`
        : undefined,
    toActions: ({ memoId, width, height }) => [
      resizeMemoAction$(memoId, width, height),
    ],
  },
];
