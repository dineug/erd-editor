/** A version 3 document with one table; the editor's parser fills in the rest. */
export function documentWithTable(tableName: string, tableId = 't1'): string {
  return JSON.stringify({
    version: '3.0.0',
    doc: {
      tableIds: [tableId],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    },
    collections: {
      tableEntities: { [tableId]: { id: tableId, name: tableName } },
    },
  });
}

/** A .vuerd file as the version 2 editor saved it, one table. */
export function version2Document(tableName: string): string {
  return JSON.stringify({
    canvas: { version: '2.0.0', width: 2000, height: 2000, databaseName: '' },
    table: {
      tables: [
        {
          id: 't1',
          name: tableName,
          comment: '',
          columns: [],
          ui: {
            active: false,
            left: 10,
            top: 20,
            zIndex: 1,
            widthName: 60,
            widthComment: 60,
          },
          visible: true,
        },
      ],
      edit: null,
      copyColumns: [],
      columnDraggable: null,
    },
    memo: { memos: [] },
    relationship: { relationships: [] },
  });
}

/** Another app's .erd, which ERD Editor must neither open nor save over. */
export const FOREIGN_ERD = JSON.stringify({
  nodes: [{ id: 'n1', type: 'entity' }],
  edges: [],
});

/** The names of a document's tables, in the order its doc lists them. */
export function tableNames(value: string): string[] {
  const { doc, collections } = JSON.parse(value);
  return doc.tableIds.map(
    (id: string) => collections.tableEntities[id]?.name as string
  );
}
