import { AppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { MapColumnsOpening, openMapColumnsAction } from '@/utils/emitter';

/**
 * Opens Map Columns on what the opening names: the dialog takes its session
 * from the emitter, then the open map shows it, so it never shows the session
 * of an earlier opening.
 */
export function openMapColumns(
  { store, emitter }: Pick<AppContext, 'store' | 'emitter'>,
  opening: MapColumnsOpening
) {
  emitter.emit(openMapColumnsAction(opening));
  store.dispatch(changeOpenMapAction({ [Open.mapColumns]: true }));
}
