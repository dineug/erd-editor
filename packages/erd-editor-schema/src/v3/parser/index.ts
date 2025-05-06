import { DeepPartial } from '@/internal-types';
import { createAndMergeDoc } from '@/v3/parser/doc';
import { createAndMergeIndexEntities } from '@/v3/parser/index.entity';
import { createAndMergeIndexColumnEntities } from '@/v3/parser/indexColumn.entity';
import { createAndMergeMemoEntities } from '@/v3/parser/memo.entity';
import { createAndMergeRelationshipEntities } from '@/v3/parser/relationship.entity';
import { createAndMergeSettings } from '@/v3/parser/settings';
import { createAndMergeTableEntities } from '@/v3/parser/table.entity';
import { createAndMergeTableColumnEntities } from '@/v3/parser/tableColumn.entity';
import { ERDEditorSchemaV3 } from '@/v3/schema';

export function parser(source: any): ERDEditorSchemaV3 {
  const json: DeepPartial<ERDEditorSchemaV3> = source;

  const settings = createAndMergeSettings(json.settings);
  const doc = createAndMergeDoc(json.doc);

  const tableEntities = createAndMergeTableEntities(
    json.collections?.tableEntities
  );
  const tableColumnEntities = createAndMergeTableColumnEntities(
    json.collections?.tableColumnEntities
  );
  const relationshipEntities = createAndMergeRelationshipEntities(
    json.collections?.relationshipEntities
  );
  const indexEntities = createAndMergeIndexEntities(
    json.collections?.indexEntities
  );
  const indexColumnEntities = createAndMergeIndexColumnEntities(
    json.collections?.indexColumnEntities
  );
  const memoEntities = createAndMergeMemoEntities(
    json.collections?.memoEntities
  );

  return {
    $schema:
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json',
    version: '3.0.0',
    settings,
    doc,
    collections: {
      tableEntities,
      tableColumnEntities,
      relationshipEntities,
      indexEntities,
      indexColumnEntities,
      memoEntities,
    },
  };
}
