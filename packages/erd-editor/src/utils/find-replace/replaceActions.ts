import { AnyAction } from '@dineug/r-html';

import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import {
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

import { FindField, FindMatch } from './findMatches';
import { Matcher } from './matcher';

/** The atom action that writes a new value into the field a match was found in. */
export function toFieldAction(
  { field, id, tableId }: Pick<FindMatch, 'field' | 'id' | 'tableId'>,
  value: string
): AnyAction {
  switch (field) {
    case FindField.tableName:
      return changeTableNameAction({ id, value });
    case FindField.tableComment:
      return changeTableCommentAction({ id, value });
    case FindField.columnName:
      return changeColumnNameAction({ id, tableId, value });
    case FindField.columnComment:
      return changeColumnCommentAction({ id, tableId, value });
    case FindField.memo:
      return changeMemoValueAction({ id, value });
  }
}

export type ReplaceActions = {
  actions: AnyAction[];
  /** The matches the replacement changed, leaving out one it wrote back as it was. */
  replaced: number;
};

/**
 * One atom action per field whose text the replacement changes, for a single
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
  const actions: AnyAction[] = [];
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
