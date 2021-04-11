import { CommandKey, CommandType } from '@@types/engine/command';

export const createCommand = <K extends CommandKey>(
  name: K,
  data: CommandType<K>['data']
) => ({
  name,
  data,
  timestamp: Date.now(),
});

export const changeCommandTypes: CommandKey[] = [
  // table
  'table.add',
  'table.move',
  'table.remove',
  'table.changeName',
  'table.changeComment',
  'table.sort',
  // column
  'column.add',
  'column.addCustom',
  'column.remove',
  'column.changeName',
  'column.changeComment',
  'column.changeDataType',
  'column.changeDefault',
  'column.changeAutoIncrement',
  'column.changePrimaryKey',
  'column.changeUnique',
  'column.changeNotNull',
  'column.move',
  // relationship
  'relationship.add',
  'relationship.remove',
  'relationship.changeRelationshipType',
  'relationship.changeIdentification',
  // index
  'index.add',
  'index.remove',
  'index.changeName',
  'index.changeUnique',
  'index.addColumn',
  'index.removeColumn',
  'index.moveColumn',
  'index.changeColumnOrderType',
  // memo
  'memo.add',
  'memo.move',
  'memo.remove',
  'memo.changeValue',
  'memo.resize',
  // canvas
  'canvas.move',
  'canvas.movement',
  'canvas.resize',
  'canvas.zoom',
  'canvas.movementZoom',
  'canvas.changeShow',
  'canvas.changeDatabase',
  'canvas.changeDatabaseName',
  'canvas.changeCanvasType',
  'canvas.changeLanguage',
  'canvas.changeTableCase',
  'canvas.changeColumnCase',
  'canvas.changeRelationshipDataTypeSync',
  'canvas.moveColumnOrder',
  'canvas.changeHighlightTheme',
  // editor
  'editor.loadJson',
  'editor.clear',
];

export const historyCommandTypes: CommandKey[] = [
  // table
  'table.add',
  'table.move',
  'table.remove',
  'table.changeName',
  'table.changeComment',
  'table.sort',
  // column
  'column.add',
  'column.addCustom',
  'column.remove',
  'column.changeName',
  'column.changeComment',
  'column.changeDataType',
  'column.changeDefault',
  'column.changeAutoIncrement',
  'column.changePrimaryKey',
  'column.changeUnique',
  'column.changeNotNull',
  'column.move',
  // relationship
  'relationship.add',
  'relationship.remove',
  'relationship.changeRelationshipType',
  'relationship.changeIdentification',
  // memo
  'memo.add',
  'memo.move',
  'memo.remove',
  'memo.changeValue',
  'memo.resize',
  // canvas
  'canvas.move',
  'canvas.movement',
  'canvas.resize',
  'canvas.zoom',
  'canvas.movementZoom',
  'canvas.changeShow',
  'canvas.changeDatabase',
  'canvas.changeDatabaseName',
  // editor
  'editor.loadJson',
  'editor.clear',
];

export const streamCommandTypes: CommandKey[] = [
  'table.move',
  'memo.move',
  'memo.resize',
  'canvas.movement',
  'canvas.movementZoom',
];

export const readonlyCommandTypes: CommandKey[] = [
  // table
  'table.select',
  'table.selectEnd',
  'table.selectAll',
  'table.dragSelect',
  // column
  'column.active',
  'column.activeEnd',
  // memo
  'memo.select',
  'memo.selectEnd',
  'memo.selectAll',
  'memo.dragSelect',
  // canvas
  'canvas.move',
  'canvas.movement',
  'canvas.zoom',
  'canvas.movementZoom',
  'canvas.changeShow',
  'canvas.changeDatabase',
  'canvas.changeCanvasType',
  'canvas.changeLanguage',
  'canvas.changeTableCase',
  'canvas.changeColumnCase',
  'canvas.moveColumnOrder',
  'canvas.changeHighlightTheme',
  // editor
  'editor.focusTable',
  'editor.focusColumn',
  'editor.focusTableEnd',
  'editor.focusMoveTable',
  'editor.editTableEnd',
  'editor.selectAllColumn',
  'editor.initLoadJson',
  'editor.initClear',
  'editor.changeViewport',
  'editor.findActive',
  'editor.findActiveEnd',
  'editor.readonly',
  // editor filter
  'editor.filter.active',
  'editor.filter.activeEnd',
  'editor.filter.add',
  'editor.filter.remove',
  'editor.filter.changeColumnType',
  'editor.filter.changeFilterCode',
  'editor.filter.changeValue',
  'editor.filter.move',
  'editor.filter.changeOperatorType',
  'editor.filter.focus',
  'editor.filter.focusFilter',
  'editor.filter.focusEnd',
  'editor.filter.focusMove',
  'editor.filter.edit',
  'editor.filter.editEnd',
  'editor.filter.selectAll',
  'editor.filter.draggable',
  'editor.filter.draggableEnd',
];
