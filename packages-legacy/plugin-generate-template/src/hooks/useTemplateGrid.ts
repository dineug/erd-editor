import { cloneDeep } from 'lodash-es';
import { observe, reaction } from 'mobx';
import { Ref } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import Grid from 'tui-grid';

import { GridCheckboxRender } from '@/components/grid/GridCheckboxRender';
import { GridTextEditor } from '@/components/grid/GridTextEditor';
import { GridTextRender } from '@/components/grid/GridTextRender';
import { Template } from '@/core/indexedDB';
import { useContext } from '@/hooks/useContext';

type GridTuple = readonly [Ref<any>, { current: Grid | null }];

const gridColumns: any = [
  {
    header: 'Name',
    name: 'name',
    renderer: { type: GridTextRender, options: { placeholder: 'name' } },
    editor: { type: GridTextEditor, options: { placeholder: 'name' } },
  },
].map((gridColumn: any) => ({
  ...gridColumn,
  sortingType: 'asc',
  sortable: true,
}));

export function useTemplateGrid(width: number): GridTuple {
  const parentRef = useRef<HTMLElement | null>();
  const gridRef = useRef<Grid | null>(null);
  const editRef = useRef(false);
  const { stores, keydown$ } = useContext();

  const getHeight = () => stores.ui.viewport.height - 60;
  const getData = () => cloneDeep(stores.template.templates) as any;

  const onAfterChange = (event: any) => {
    if (!gridRef.current) return;
    const grid = gridRef.current;
    const { rowKey } = event;
    const row = grid.getRow(rowKey) as Template | null;

    if (row) {
      const { uuid, name, value } = row;

      switch (event.columnName) {
        case 'name':
          stores.template.update({
            uuid,
            name,
            value,
          });
          break;
      }
    }

    grid.clearModifiedData();
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!gridRef.current) return;
    const grid = gridRef.current;

    if (
      !editRef.current &&
      (event.key === 'Delete' || event.key === 'Backspace')
    ) {
      const updatedRows = grid.getModifiedRows().updatedRows;
      if (!updatedRows) return;

      updatedRows.forEach(({ uuid, name, value }: any) => {
        stores.template.update({
          uuid,
          name,
          value,
        });
      });
    }

    grid.clearModifiedData();
  };

  const onEditingStart = () => (editRef.current = true);
  const onEditingFinish = () => (editRef.current = false);
  const onGridEvent = () => {
    if (!gridRef.current) return;
    gridRef.current.on('editingStart', onEditingStart);
    gridRef.current.on('editingFinish', onEditingFinish);
  };
  const offGridEvent = () => {
    if (!gridRef.current) return;
    gridRef.current.off('editingStart', onEditingStart);
    gridRef.current.off('editingFinish', onEditingFinish);
  };

  useEffect(() => {
    gridRef.current = new Grid({
      el: parentRef.current as HTMLElement,
      usageStatistics: false,
      bodyHeight: getHeight(),
      columnOptions: {
        resizable: true,
      },
      rowHeaders: [
        {
          type: 'checkbox',
          renderer: {
            type: GridCheckboxRender,
          },
        },
      ],
      columns: gridColumns.map((gridColumn: any) => ({
        ...gridColumn,
        onAfterChange,
      })),
      data: getData(),
    });

    const subscription = keydown$.subscribe(onKeydown);
    const disposers = [
      observe(stores.ui.viewport, () => {
        gridRef.current?.setBodyHeight(getHeight());
      }),
      reaction(
        () => stores.template.templates.length,
        () => gridRef.current?.resetData(getData())
      ),
    ];
    onGridEvent();

    return () => {
      disposers.forEach(f => f());
      subscription.unsubscribe();
      if (!gridRef.current) return;
      offGridEvent();
      gridRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.setWidth(width);
  }, [width]);

  return [parentRef, gridRef];
}
