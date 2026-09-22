import { nanoid } from 'nanoid';

import type { ActionTool, ToolArg } from '@/agent/registry';
import { RelationshipType } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  addRelationshipAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { addRelationshipAction$ } from '@/engine/modules/relationship/generator.actions';

const RELATIONSHIP_ID: ToolArg = {
  name: 'relationshipId',
  kind: { type: 'entityId', entity: 'relationship' },
  required: true,
};

const RELATIONSHIP_TYPE: ToolArg = {
  name: 'relationshipType',
  kind: { type: 'enum', values: RelationshipType },
  required: true,
};

const tableArg = (name: string): ToolArg => ({
  name,
  kind: { type: 'entityId', entity: 'table' },
  required: true,
});

const columnsArg = (name: string, parentArg: string): ToolArg => ({
  name,
  kind: { type: 'entityIdList', entity: 'column', parentArg },
  required: true,
});

/** The id is drawn as the call runs, so each call relates under a new one. */
const linkColumnsAction$ = ({
  startTableId,
  startColumnIds,
  endTableId,
  endColumnIds,
  relationshipType,
}: Record<string, any>): GeneratorAction =>
  function* () {
    yield addRelationshipAction({
      id: nanoid(),
      relationshipType,
      start: { tableId: startTableId, columnIds: startColumnIds },
      end: { tableId: endTableId, columnIds: endColumnIds },
    });
  };

export const relationshipTools: readonly ActionTool[] = [
  {
    name: 'erd_add_relationship',
    kind: 'generator',
    actionTypes: [
      'column.add',
      'column.changePrimaryKey',
      'column.changeNotNull',
      'column.changeName',
      'column.changeDataType',
      'column.changeDefault',
      'column.changeComment',
      'relationship.add',
    ],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: [
      'relationships',
      'tables[startTableId].columns',
      'tables[endTableId].columns',
    ],
    args: [tableArg('startTableId'), tableArg('endTableId'), RELATIONSHIP_TYPE],
    toActions: ({ startTableId, endTableId, relationshipType }) => [
      addRelationshipAction$(startTableId, endTableId, relationshipType),
    ],
  },
  {
    name: 'erd_link_columns',
    kind: 'atom',
    atomReason:
      'addRelationshipAction$ always copies the start keys into new columns of the end table, and selectTableAction$ does the same while a relationship is drawn. This tool relates columns that already exist, so it adds the relationship with this atom.',
    actionTypes: ['relationship.add'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['relationships'],
    args: [
      tableArg('startTableId'),
      columnsArg('startColumnIds', 'startTableId'),
      tableArg('endTableId'),
      columnsArg('endColumnIds', 'endTableId'),
      RELATIONSHIP_TYPE,
    ],
    refine: ({ startColumnIds, endColumnIds }) =>
      startColumnIds.length === endColumnIds.length
        ? undefined
        : 'startColumnIds and endColumnIds must pair up, one end column for each start column',
    toActions: values => [linkColumnsAction$(values)],
  },
  {
    name: 'erd_remove_relationship',
    kind: 'atom',
    atomReason:
      'No generator removes one named relationship: removeTableAction$ and removeColumnAction$ drop only the relationships of what they remove. The context menu dispatches this atom itself.',
    actionTypes: ['relationship.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['relationships'],
    args: [RELATIONSHIP_ID],
    toActions: ({ relationshipId }) => [
      removeRelationshipAction({ id: relationshipId }),
    ],
  },
  {
    name: 'erd_change_relationship_type',
    kind: 'atom',
    atomReason:
      'The relationship module has no generator that changes a type; the context menu dispatches this atom itself.',
    actionTypes: ['relationship.changeType'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['relationships[relationshipId].relationshipType'],
    args: [RELATIONSHIP_ID, RELATIONSHIP_TYPE],
    toActions: ({ relationshipId, relationshipType }) => [
      changeRelationshipTypeAction({
        id: relationshipId,
        value: relationshipType,
      }),
    ],
  },
];
