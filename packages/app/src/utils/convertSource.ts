import '@dineug/erd-editor';

import type { SourceImport } from '@/utils/importFile';

/**
 * The document a SQL, DBML, AML or GraphQL source parses to. The app has no
 * parser of its own, so an editor that is never attached parses it: its store
 * lays the tables out as it goes, and nothing of it renders or outlives this.
 */
export function convertSource({ type, value }: SourceImport): string {
  const editor = document.createElement('erd-editor');

  try {
    switch (type) {
      case 'sql':
        editor.setSchemaSQL(value);
        break;
      case 'dbml':
        editor.setSchemaDBML(value);
        break;
      case 'aml':
        editor.setSchemaAML(value);
        break;
      case 'graphql':
        editor.setSchemaGraphQL(value);
        break;
    }

    // Connector anchors and the flags a relationship reads off its columns
    // follow from the store's hooks a few milliseconds later. Every load
    // derives them again, so the value is complete for storing as it stands.
    return editor.value;
  } finally {
    editor.destroy();
  }
}
