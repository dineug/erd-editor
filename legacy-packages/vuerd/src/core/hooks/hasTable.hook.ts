import { TableProps } from '@/components/editor/table/Table';
import { useContext } from '@/core/hooks/context.hook';
import {
  isDraggableColumn,
  isEdit,
  isFocus,
  isSelectColumn,
} from '@/engine/store/helper/editor.helper';
import { FocusType } from '@@types/engine/store/editor.state';

export function useHasTable(props: TableProps, ctx: HTMLElement) {
  const contextRef = useContext(ctx);

  const getFocusTable = () => contextRef.value.store.editorState.focusTable;

  const hasFocusState = (focusType: FocusType, columnId?: string) =>
    isFocus(getFocusTable(), focusType, props.table.id, columnId);

  const hasEdit = (focusType: FocusType, columnId?: string) =>
    isEdit(getFocusTable(), focusType, props.table.id, columnId);

  const hasSelectColumn = (columnId: string) =>
    isSelectColumn(getFocusTable(), props.table.id, columnId);

  const hasDraggableColumn = (columnId: string) => {
    const draggableColumn = contextRef.value.store.editorState.draggableColumn;
    return isDraggableColumn(draggableColumn, props.table.id, columnId);
  };

  return {
    hasFocusState,
    hasEdit,
    hasSelectColumn,
    hasDraggableColumn,
  };
}
