import '@/erd-viewer';

import { createSchema } from '@dineug/erd-editor-schema';
import type { Meta, StoryObj } from '@storybook/html-vite';

import {
  ColumnOption,
  ColumnUIKey,
  NameViewMode,
  RelationshipType,
} from '@/constants/schema';
import type { ValuesType } from '@/internal-types';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

type ErdViewerStoryArgs = {
  minimap: boolean;
  controls: boolean;
  nameView: ValuesType<typeof NameViewMode>;
};

/** One column of a sample table: its name, its type and the key it carries. */
type ColumnSample = [name: string, dataType: string, key?: 'pk' | 'fk'];

/** The document every story draws: three tables a post and its comments join, and a memo. */
function sampleDocument(): string {
  const schema = createSchema();
  const { doc, collections } = schema;

  const addTable = (
    name: string,
    x: number,
    y: number,
    columns: ColumnSample[]
  ) => {
    const columnIds = columns.map(([column]) => `${name}_${column}`);
    for (const [index, [column, dataType, key]] of columns.entries()) {
      collections.tableColumnEntities[columnIds[index]] = createColumn({
        id: columnIds[index],
        tableId: name,
        name: column,
        dataType,
        options:
          key === 'pk' ? ColumnOption.primaryKey | ColumnOption.notNull : 0,
        ui: {
          keys:
            key === 'pk'
              ? ColumnUIKey.primaryKey
              : key === 'fk'
                ? ColumnUIKey.foreignKey
                : 0,
        },
      });
    }
    collections.tableEntities[name] = createTable({
      id: name,
      name,
      columnIds,
      seqColumnIds: columnIds,
      ui: { x, y },
    });
    doc.tableIds.push(name);
  };

  const addRelationship = (from: string, to: string, column: string) => {
    const id = `${from}_${to}`;
    collections.relationshipEntities[id] = createRelationship({
      id,
      relationshipType: RelationshipType.OneN,
      start: { tableId: from, columnIds: [`${from}_id`] },
      end: { tableId: to, columnIds: [`${to}_${column}`] },
    });
    doc.relationshipIds.push(id);
  };

  addTable('users', 80, 80, [
    ['id', 'BIGINT', 'pk'],
    ['email', 'VARCHAR(255)'],
    ['name', 'VARCHAR(80)'],
  ]);
  addTable('posts', 520, 80, [
    ['id', 'BIGINT', 'pk'],
    ['user_id', 'BIGINT', 'fk'],
    ['title', 'VARCHAR(200)'],
  ]);
  addTable('comments', 520, 360, [
    ['id', 'BIGINT', 'pk'],
    ['post_id', 'BIGINT', 'fk'],
    ['user_id', 'BIGINT', 'fk'],
    ['body', 'TEXT'],
  ]);
  addRelationship('users', 'posts', 'user_id');
  addRelationship('posts', 'comments', 'post_id');
  addRelationship('users', 'comments', 'user_id');

  collections.memoEntities.note = createMemo({
    id: 'note',
    value: 'A read-only view: drag to pan, click to light a table.',
    ui: { x: 80, y: 360 },
  });
  doc.memoIds.push('note');

  return JSON.stringify(schema);
}

const meta = {
  title: 'ErdViewer',
  render: ({ minimap, controls, nameView }) => {
    const viewer = document.createElement('erd-viewer');
    viewer.setAttribute('minimap', String(minimap));
    viewer.setAttribute('controls', String(controls));
    viewer.setAttribute('name-view', nameView);
    viewer.value = sampleDocument();
    return viewer;
  },
  argTypes: {
    minimap: { type: 'boolean' },
    controls: { type: 'boolean' },
    nameView: {
      control: 'select',
      options: [NameViewMode.physical, NameViewMode.logical, NameViewMode.both],
    },
  },
  parameters: {
    css: `
      body {
        padding: 0 !important;
        margin: 0 !important;
      }

      #storybook-root {
        height: 100vh;
      }

      #storybook-root > div {
        height: 100%;
      }
    `,
  },
} satisfies Meta<ErdViewerStoryArgs>;

export default meta;
type Story = StoryObj<ErdViewerStoryArgs>;

export const Normal: Story = {
  args: {
    minimap: true,
    controls: true,
    nameView: NameViewMode.physical,
  },
};

export const Bare: Story = {
  args: {
    minimap: false,
    controls: false,
    nameView: NameViewMode.physical,
  },
};
