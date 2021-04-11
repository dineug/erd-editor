import { GridTextRender } from '@/extensions/panels/grid/components/grid/GridTextRender';
import { GridTextEditor } from '@/extensions/panels/grid/components/grid/GridTextEditor';
import { GridColumnOptionEditor } from '@/extensions/panels/grid/components/grid/GridColumnOptionEditor';
import { GridColumnDataTypeEditor } from '@/extensions/panels/grid/components/grid/GridColumnDataTypeEditor';

export const gridColumns: any = [
  {
    header: 'Table Name',
    name: 'tableName',
    renderer: { type: GridTextRender, options: { placeholder: 'table' } },
    editor: { type: GridTextEditor, options: { placeholder: 'table' } },
  },
  {
    header: 'Table Comment',
    name: 'tableComment',
    renderer: { type: GridTextRender, options: { placeholder: 'comment' } },
    editor: { type: GridTextEditor, options: { placeholder: 'comment' } },
  },
  {
    header: 'Option',
    name: 'option',
    minWidth: 100,
    renderer: { type: GridTextRender, options: { placeholder: 'option' } },
    editor: { type: GridColumnOptionEditor },
  },
  {
    header: 'Name',
    name: 'name',
    renderer: { type: GridTextRender, options: { placeholder: 'column' } },
    editor: { type: GridTextEditor, options: { placeholder: 'column' } },
  },
  {
    header: 'DataType',
    name: 'dataType',
    minWidth: 200,
    renderer: { type: GridTextRender, options: { placeholder: 'dataType' } },
    editor: { type: GridColumnDataTypeEditor },
  },
  {
    header: 'Default',
    name: 'default',
    renderer: { type: GridTextRender, options: { placeholder: 'default' } },
    editor: { type: GridTextEditor, options: { placeholder: 'default' } },
  },
  {
    header: 'Comment',
    name: 'comment',
    renderer: { type: GridTextRender, options: { placeholder: 'comment' } },
    editor: { type: GridTextEditor, options: { placeholder: 'comment' } },
  },
].map((gridColumn: any) => ({
  ...gridColumn,
  sortingType: 'asc',
  sortable: true,
}));
