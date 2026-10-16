import type { AppContext } from '@/components/appContext';
import { setQuery } from '@/components/explorer/explorerSearch';
import { explorerViewOf } from '@/components/explorer/explorerView';
import { openFindReplaceAction } from '@/utils/emitter';
import {
  DEFAULT_FIND_OPTIONS,
  type FindField,
  FindFieldList,
} from '@/utils/find-replace';

/**
 * Opens the Explorer's search as the palette row does and, given a query and
 * an opening, searches it over the kinds given with the default options, every
 * kind unless told otherwise, as a reader sets them before typing.
 */
export function openSearchOn(
  app: AppContext,
  query?: string,
  fields: FindField[] = [...FindFieldList]
): void {
  app.emitter.emit(openFindReplaceAction());
  const view = explorerViewOf(app.store);
  // A search that opened nothing, under a takeover, takes no query either.
  if (query === undefined || !view.open) return;

  Object.assign(view, DEFAULT_FIND_OPTIONS);
  view.fields = fields;
  setQuery(app.store, query);
}
