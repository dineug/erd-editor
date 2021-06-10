import { uuid } from '@/core/helper';
import { createCommand } from '@/engine/command/helper';
import { Store } from '@@types/engine/store';
import { MoveKey } from '@@types/engine/store/editor.state';
import {
  ColumnType,
  FocusFilterType,
  OperatorType,
  TextFilterCode,
} from '@@types/engine/store/editor/filter.state';

export * from './filter.cmd.helper.gen';

export const filterActive = () => createCommand('editor.filter.active', null);

export const filterActiveEnd = () =>
  createCommand('editor.filter.activeEnd', null);

export const addFilter = () =>
  createCommand('editor.filter.add', {
    id: uuid(),
  });

export const removeFilter = (filterIds: string[]) =>
  createCommand('editor.filter.remove', {
    filterIds,
  });

export const changeFilterColumnType = (
  filterId: string,
  columnType: ColumnType
) =>
  createCommand('editor.filter.changeColumnType', {
    filterId,
    columnType,
  });

export const changeFilterCode = (
  filterId: string,
  filterCode: TextFilterCode
) =>
  createCommand('editor.filter.changeFilterCode', {
    filterId,
    filterCode,
  });

export const changeFilterValue = (filterId: string, value: string) =>
  createCommand('editor.filter.changeValue', {
    filterId,
    value,
  });

export const moveFilter = (filterIds: string[], targetFilterId: string) =>
  createCommand('editor.filter.move', {
    filterIds,
    targetFilterId,
  });

export const changeFilterOperatorType = (operatorType: OperatorType) =>
  createCommand('editor.filter.changeOperatorType', {
    operatorType,
  });

export const filterFocus = (focusType?: 'operatorType') =>
  createCommand('editor.filter.focus', {
    focusType,
  });

export const focusFilter = (
  filterId: string,
  focusType: FocusFilterType,
  ctrlKey = false,
  shiftKey = false
) =>
  createCommand('editor.filter.focusFilter', {
    filterId,
    focusType,
    ctrlKey,
    shiftKey,
  });

export const focusFilterEnd = () =>
  createCommand('editor.filter.focusEnd', null);

export const focusMoveFilter = (moveKey: MoveKey, shiftKey: boolean) =>
  createCommand('editor.filter.focusMove', {
    moveKey,
    shiftKey,
  });

export const editFilter = () => createCommand('editor.filter.edit', null);

export const editFilterEnd = () => createCommand('editor.filter.editEnd', null);

export const selectAllFilter = () =>
  createCommand('editor.filter.selectAll', null);

export const draggableFilter = (
  {
    editorState: {
      filterState: { focus },
    },
  }: Store,
  filterId: string,
  ctrlKey: boolean
) =>
  createCommand('editor.filter.draggable', {
    filterIds: ctrlKey && focus ? [...focus.selectFilterIds] : [filterId],
  });

export const draggableFilterEnd = () =>
  createCommand('editor.filter.draggableEnd', null);
