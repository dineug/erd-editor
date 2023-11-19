import { useAppContext } from '@/components/appContext';
import { FocusType } from '@/engine/modules/editor/state';
import { Ctx } from '@/internal-types';
import { isEdit, isFocus, isSelectColumn } from '@/utils/focus';

export function useFocusTable(ctx: Ctx, tableId: string) {
  const app = useAppContext(ctx);

  const getFocusTable = () => app.value.store.state.editor.focusTable;

  const hasFocus = (focusType: FocusType, columnId?: string) =>
    isFocus(getFocusTable(), focusType, tableId, columnId);

  const hasEdit = (focusType: FocusType, columnId?: string) =>
    isEdit(getFocusTable(), focusType, tableId, columnId);

  const hasSelectColumn = (columnId: string) =>
    isSelectColumn(getFocusTable(), tableId, columnId);

  return {
    hasFocus,
    hasEdit,
    hasSelectColumn,
  };
}
