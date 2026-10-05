import {
  type GeneratorAction,
  ReferentialAction,
  relationshipActions,
  relationshipActions$,
  RelationshipType,
} from '@dineug/erd-editor/peer.js';
import { uuid25 } from '@dineug/uuid';

import type { ActionTool, ToolArg } from '@/tools/registry';

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

const referentialActionArg = (
  name: 'onDelete' | 'onUpdate',
  required = true
): ToolArg => ({
  name,
  kind: { type: 'enum', values: ReferentialAction },
  required,
});

/** A new relationship's actions, optional: left out, each is none. */
const NEW_REFERENTIAL_ACTIONS: readonly ToolArg[] = [
  referentialActionArg('onDelete', false),
  referentialActionArg('onUpdate', false),
];

/** The actions a call passed; one left out stays off the relationship.add payload. */
const referentialActionsOf = ({ onDelete, onUpdate }: Record<string, any>) => ({
  ...(onDelete === undefined ? {} : { onDelete }),
  ...(onUpdate === undefined ? {} : { onUpdate }),
});

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
const linkColumnsAction$ = (values: Record<string, any>): GeneratorAction =>
  function* () {
    const {
      startTableId,
      startColumnIds,
      endTableId,
      endColumnIds,
      relationshipType,
    } = values;

    yield relationshipActions.addRelationshipAction({
      id: uuid25(),
      relationshipType,
      ...referentialActionsOf(values),
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
    args: [
      tableArg('startTableId'),
      tableArg('endTableId'),
      RELATIONSHIP_TYPE,
      ...NEW_REFERENTIAL_ACTIONS,
    ],
    toActions: values => [
      relationshipActions$.addRelationshipAction$(
        values.startTableId,
        values.endTableId,
        values.relationshipType,
        referentialActionsOf(values)
      ),
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
      ...NEW_REFERENTIAL_ACTIONS,
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
      relationshipActions.removeRelationshipAction({ id: relationshipId }),
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
      relationshipActions.changeRelationshipTypeAction({
        id: relationshipId,
        value: relationshipType,
      }),
    ],
  },
  {
    name: 'erd_change_relationship_on_delete',
    kind: 'atom',
    atomReason:
      'The relationship module has no generator that changes a referential action; the context menu dispatches this atom itself.',
    actionTypes: ['relationship.changeOnDelete'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['relationships[relationshipId].onDelete'],
    args: [RELATIONSHIP_ID, referentialActionArg('onDelete')],
    toActions: ({ relationshipId, onDelete }) => [
      relationshipActions.changeRelationshipOnDeleteAction({
        id: relationshipId,
        value: onDelete,
      }),
    ],
  },
  {
    name: 'erd_change_relationship_on_update',
    kind: 'atom',
    atomReason:
      'The relationship module has no generator that changes a referential action; the context menu dispatches this atom itself.',
    actionTypes: ['relationship.changeOnUpdate'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['relationships[relationshipId].onUpdate'],
    args: [RELATIONSHIP_ID, referentialActionArg('onUpdate')],
    toActions: ({ relationshipId, onUpdate }) => [
      relationshipActions.changeRelationshipOnUpdateAction({
        id: relationshipId,
        value: onUpdate,
      }),
    ],
  },
];
