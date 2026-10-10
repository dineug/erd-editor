import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { isString } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import { arrayHas } from '@/utils/arrayHas';
import { createTableGroup } from '@/utils/collection/tableGroup.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addTableGroupAction = createAction<
  ActionMap[typeof ActionType.addTableGroup]
>(ActionType.addTableGroup);

const addTableGroup: ReducerType<typeof ActionType.addTableGroup> = (
  { doc, collections, lww },
  { payload: { id, color, ui }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('tableGroupEntities')
    .addOne(createTableGroup({ id, ui, ...(isString(color) ? { color } : {}) }))
    .addOperator(lww, safeVersion, id, () => {
      if (!arrayHas(doc.tableGroupIds)(id)) {
        doc.tableGroupIds.push(id);
      }
    });
};

export const moveTableGroupAction = createAction<
  ActionMap[typeof ActionType.moveTableGroup]
>(ActionType.moveTableGroup);

const moveTableGroup: ReducerType<typeof ActionType.moveTableGroup> = (
  { collections },
  { payload: { ids, movementX, movementY } }
) => {
  const collection = query(collections).collection('tableGroupEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createTableGroup({ id }));
  }

  collection.updateMany(ids, group => {
    group.ui.x = round(group.ui.x + movementX, 4);
    group.ui.y = round(group.ui.y + movementY, 4);
  });
};

export const moveToTableGroupAction = createAction<
  ActionMap[typeof ActionType.moveToTableGroup]
>(ActionType.moveToTableGroup);

const moveToTableGroup: ReducerType<typeof ActionType.moveToTableGroup> = (
  { collections },
  { payload: { id, x, y } }
) => {
  const collection = query(collections).collection('tableGroupEntities');
  collection.getOrCreate(id, id => createTableGroup({ id }));

  collection.updateOne(id, group => {
    group.ui.x = x;
    group.ui.y = y;
  });
};

export const removeTableGroupAction = createAction<
  ActionMap[typeof ActionType.removeTableGroup]
>(ActionType.removeTableGroup);

const removeTableGroup: ReducerType<typeof ActionType.removeTableGroup> = (
  { doc, collections, lww },
  { payload: { id }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('tableGroupEntities')
    .removeOperator(lww, safeVersion, id, () => {
      const index = doc.tableGroupIds.indexOf(id);
      if (index !== -1) {
        doc.tableGroupIds.splice(index, 1);
      }
    });
};

export const resizeTableGroupAction = createAction<
  ActionMap[typeof ActionType.resizeTableGroup]
>(ActionType.resizeTableGroup);

const resizeTableGroup: ReducerType<typeof ActionType.resizeTableGroup> = (
  { collections },
  { payload: { id, x, y, width, height } }
) => {
  const collection = query(collections).collection('tableGroupEntities');
  collection.getOrCreate(id, id => createTableGroup({ id }));

  collection.updateOne(id, group => {
    group.ui.x = x;
    group.ui.y = y;
    group.ui.width = width;
    group.ui.height = height;
  });
};

export const changeTableGroupNameAction = createAction<
  ActionMap[typeof ActionType.changeTableGroupName]
>(ActionType.changeTableGroupName);

const changeTableGroupName: ReducerType<
  typeof ActionType.changeTableGroupName
> = ({ collections, lww }, { payload: { id, value }, version }, { clock }) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableGroupEntities');
  collection.getOrCreate(id, id => createTableGroup({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'name', () => {
    collection.updateOne(id, group => {
      group.name = value;
    });
  });
};

export const changeTableGroupColorAction = createAction<
  ActionMap[typeof ActionType.changeTableGroupColor]
>(ActionType.changeTableGroupColor);

const changeTableGroupColor: ReducerType<
  typeof ActionType.changeTableGroupColor
> = ({ collections, lww }, { payload: { id, color }, version }, { clock }) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableGroupEntities');
  collection.getOrCreate(id, id => createTableGroup({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'color', () => {
    collection.updateOne(id, group => {
      group.color = color;
    });
  });
};

export const changeTableGroupZIndexAction = createAction<
  ActionMap[typeof ActionType.changeTableGroupZIndex]
>(ActionType.changeTableGroupZIndex);

const changeTableGroupZIndex: ReducerType<
  typeof ActionType.changeTableGroupZIndex
> = ({ collections }, { payload: { id, zIndex } }) => {
  const collection = query(collections).collection('tableGroupEntities');
  collection.getOrCreate(id, id => createTableGroup({ id }));

  collection.updateOne(id, group => {
    group.ui.zIndex = zIndex;
  });
};

export const tableGroupReducers = {
  [ActionType.addTableGroup]: addTableGroup,
  [ActionType.moveTableGroup]: moveTableGroup,
  [ActionType.moveToTableGroup]: moveToTableGroup,
  [ActionType.removeTableGroup]: removeTableGroup,
  [ActionType.resizeTableGroup]: resizeTableGroup,
  [ActionType.changeTableGroupName]: changeTableGroupName,
  [ActionType.changeTableGroupColor]: changeTableGroupColor,
  [ActionType.changeTableGroupZIndex]: changeTableGroupZIndex,
};

export const actions = {
  addTableGroupAction,
  moveTableGroupAction,
  moveToTableGroupAction,
  removeTableGroupAction,
  resizeTableGroupAction,
  changeTableGroupNameAction,
  changeTableGroupColorAction,
  changeTableGroupZIndexAction,
};
