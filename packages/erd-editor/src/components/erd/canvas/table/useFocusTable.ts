import { useAppContext } from '@/components/context';
import { FocusType } from '@/engine/modules/editor/state';
import { isEdit, isFocus, isSelectColumn } from '@/utils/focus';

export function useFocusTable(
  ctx: Parameters<typeof useAppContext>[0],
  tableId: string
) {
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
