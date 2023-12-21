import { ERDEditorSchemaV3, query } from '@dineug/erd-editor-schema';

import { GCIds } from '@/services/schema-gc';

export function procGC(
  { collections, lww }: ERDEditorSchemaV3,
  {
    tableIds,
    tableColumnIds,
    relationshipIds,
    indexIds,
    indexColumnIds,
    memoIds,
  }: GCIds
) {
  query(collections).collection('tableEntities').removeMany(tableIds);
  query(collections)
    .collection('tableColumnEntities')
    .removeMany(tableColumnIds);
  query(collections)
    .collection('relationshipEntities')
    .removeMany(relationshipIds);
  query(collections).collection('indexEntities').removeMany(indexIds);
  query(collections)
    .collection('indexColumnEntities')
    .removeMany(indexColumnIds);
  query(collections).collection('memoEntities').removeMany(memoIds);

  [
    ...tableIds,
    ...tableColumnIds,
    ...relationshipIds,
    ...indexIds,
    ...indexColumnIds,
    ...memoIds,
  ].forEach(id => Reflect.deleteProperty(lww, id));
}
