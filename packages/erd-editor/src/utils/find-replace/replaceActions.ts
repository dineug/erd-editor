import { CompositionAction } from '@dineug/r-html';

import { FocusType } from '@/engine/modules/editor/state';
import { changeIndexNameAction } from '@/engine/modules/index/atom.actions';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import { changeTableCommentAction } from '@/engine/modules/table/atom.actions';
import { changeTableNameAction$ } from '@/engine/modules/table/generator.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import { changeColumnValueAction$ } from '@/engine/modules/table-column/generator.actions';
import { changeTableGroupNameAction } from '@/engine/modules/table-group/atom.actions';

import { FindField, FindMatch } from './findMatches';
import { Matcher } from './matcher';

/**
 * What writes a new value into the field a match was found in, as an edit by
 * hand does: a name through the generator that turns its derived flag off,
 * every other field through its atom action.
 */
export function toFieldAction(
  { field, id, tableId }: Pick<FindMatch, 'field' | 'id' | 'tableId'>,
  value: string
): CompositionAction {
  switch (field) {
    case FindField.tableName:
      return changeTableNameAction$(id, value);
    case FindField.tableComment:
      return changeTableCommentAction({ id, value });
    case FindField.columnName:
      return changeColumnValueAction$(FocusType.columnName, tableId, id, value);
    case FindField.columnComment:
      return changeColumnCommentAction({ id, tableId, value });
    case FindField.memo:
      return changeMemoValueAction({ id, value });
    case FindField.indexName:
      return changeIndexNameAction({ id, tableId, value });
    case FindField.tableGroupName:
      return changeTableGroupNameAction({ id, value });
  }
}

export type ReplaceActions = {
  actions: CompositionAction[];
  /** The matches the replacement changed, leaving out one it wrote back as it was. */
  replaced: number;
};

/**
 * One field action per field whose text the replacement changes, for a single
 * dispatch: one undo entry, and the same LWW writes a peer receives from an
 * edit by hand. Given one match, only that occurrence is replaced.
 *
 * @example
 * store.dispatchSync(toReplaceActions(matches, matcher, 'account_id').actions);
 */
export function toReplaceActions(
  matches: ReadonlyArray<FindMatch>,
  matcher: Matcher,
  replacement: string,
  only?: FindMatch
): ReplaceActions {
  const actions: CompositionAction[] = [];
  const seen = new Set<number>();
  let replaced = 0;

  for (const match of only ? [only] : matches) {
    if (seen.has(match.slot)) continue;
    seen.add(match.slot);

    const { value, changed } = matcher.replace(
      match.text,
      replacement,
      only?.start
    );
    replaced += changed;
    value !== match.text && actions.push(toFieldAction(match, value));
  }

  return { actions, replaced };
}
