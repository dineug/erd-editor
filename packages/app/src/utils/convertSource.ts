import '@dineug/erd-editor';

import type { SourceImport } from '@/utils/importFile';

/** Lays the tables out by their relationships, as the editor's own Import menu does. */
const PLACED = { placement: 'auto' } as const;

/**
 * The document a SQL, DBML, AML or GraphQL source parses to. The app has no
 * parser of its own, so an editor that is never attached parses it and places
 * its tables, and nothing of it renders or outlives the placement.
 */
export async function convertSource({
  type,
  value,
}: SourceImport): Promise<string> {
  const editor = document.createElement('erd-editor');

  try {
    switch (type) {
      case 'sql':
        await editor.setSchemaSQL(value, PLACED);
        break;
      case 'dbml':
        await editor.setSchemaDBML(value, PLACED);
        break;
      case 'aml':
        await editor.setSchemaAML(value, PLACED);
        break;
      case 'graphql':
        await editor.setSchemaGraphQL(value, PLACED);
        break;
    }

    // Connector anchors and the flags a relationship reads off its columns
    // follow from the store's hooks a few milliseconds after the document
    // lands. Every load derives them again, so the value stores as it stands.
    return editor.value;
  } finally {
    editor.destroy();
  }
}
