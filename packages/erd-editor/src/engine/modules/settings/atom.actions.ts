import { replaceOperator } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { clamp, isNil } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import { Viewport } from '@/engine/modules/editor/state';
import { Tag } from '@/engine/tag';
import { Settings } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  canvasSizeInRange,
  hasBracketType,
  hasColumnType,
  hasDatabase,
  hasLanguage,
  hasNameCase,
  maxWidthCommentInRange,
  zoomLevelInRange,
} from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';
import { type ScrollRange, toScrollRange } from './scrollRange';

export type { ScrollRange } from './scrollRange';

export const changeDatabaseNameAction = createAction<
  ActionMap[typeof ActionType.changeDatabaseName]
>(ActionType.changeDatabaseName);

const changeDatabaseName: ReducerType<typeof ActionType.changeDatabaseName> = (
  { settings, lww },
  { payload: { value }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  replaceOperator(
    lww,
    safeVersion,
    'settings.databaseName',
    'settings',
    'databaseName',
    () => {
      settings.databaseName = value;
    }
  );
};

export const resizeAction = createAction<ActionMap[typeof ActionType.resize]>(
  ActionType.resize
);

const resize: ReducerType<typeof ActionType.resize> = (
  { settings },
  { payload: { width, height } }
) => {
  settings.width = canvasSizeInRange(width);
  settings.height = canvasSizeInRange(height);
};

export const changeZoomLevelAction = createAction<
  ActionMap[typeof ActionType.changeZoomLevel]
>(ActionType.changeZoomLevel);

const changeZoomLevel: ReducerType<typeof ActionType.changeZoomLevel> = (
  { settings },
  { payload: { value }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.zoomLevel = zoomLevelInRange(value);
};

export const streamZoomLevelAction = createAction<
  ActionMap[typeof ActionType.streamZoomLevel]
>(ActionType.streamZoomLevel);

const streamZoomLevel: ReducerType<typeof ActionType.streamZoomLevel> = (
  { settings },
  { payload: { value }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.zoomLevel = zoomLevelInRange(settings.zoomLevel + value);
};

export type ScrollRanges = {
  left: ScrollRange;
  top: ScrollRange;
};

/** The canvas box and the zoom that draws it, which is all a range needs. */
export type ScrollTransform = Pick<Settings, 'width' | 'height' | 'zoomLevel'>;

/**
 * How far the origin may travel on each axis. The drawn box is the canvas box
 * at the zoom, so magnifying reaches further both ways, while shrinking closes
 * the travel in by the zoom instead of leaving the box's own.
 */
export function getScrollRanges(
  settings: ScrollTransform,
  viewport: Viewport
): ScrollRanges {
  const { width, height, zoomLevel } = settings;

  return {
    left: toScrollRange(width * zoomLevel, viewport.width, zoomLevel),
    top: toScrollRange(height * zoomLevel, viewport.height, zoomLevel),
  };
}

/** The clamps every reducer that writes the origin shares. */
export function createScrollInRange(
  settings: ScrollTransform,
  viewport: Viewport
) {
  const { left, top } = getScrollRanges(settings, viewport);

  return {
    originXInRange: (value: number) => clamp(value, left.min, left.max),
    originYInRange: (value: number) => clamp(value, top.min, top.max),
  };
}

export const scrollToAction = createAction<
  ActionMap[typeof ActionType.scrollTo]
>(ActionType.scrollTo);

const scrollTo: ReducerType<typeof ActionType.scrollTo> = (
  { settings, editor: { viewport } },
  { payload: { originX, originY }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  const { originXInRange, originYInRange } = createScrollInRange(
    settings,
    viewport
  );

  settings.originX = round(originXInRange(originX), 4);
  settings.originY = round(originYInRange(originY), 4);
};

export const streamScrollToAction = createAction<
  ActionMap[typeof ActionType.streamScrollTo]
>(ActionType.streamScrollTo);

const streamScrollTo: ReducerType<typeof ActionType.streamScrollTo> = (
  { settings, editor: { viewport } },
  { payload: { movementX, movementY }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  const { originXInRange, originYInRange } = createScrollInRange(
    settings,
    viewport
  );

  settings.originX = round(originXInRange(settings.originX + movementX), 4);
  settings.originY = round(originYInRange(settings.originY + movementY), 4);
};

export const changeShowAction = createAction<
  ActionMap[typeof ActionType.changeShow]
>(ActionType.changeShow);

const changeShow: ReducerType<typeof ActionType.changeShow> = (
  { settings },
  { payload: { show, value } }
) => {
  settings.show = value ? settings.show | show : settings.show & ~show;
};

export const changeDatabaseAction = createAction<
  ActionMap[typeof ActionType.changeDatabase]
>(ActionType.changeDatabase);

const changeDatabase: ReducerType<typeof ActionType.changeDatabase> = (
  { settings },
  { payload: { value } }
) => {
  if (hasDatabase(value)) {
    settings.database = value;
  }
};

export const changeCanvasTypeAction = createAction<
  ActionMap[typeof ActionType.changeCanvasType]
>(ActionType.changeCanvasType);

const changeCanvasType: ReducerType<typeof ActionType.changeCanvasType> = (
  { settings },
  { payload: { value }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.canvasType = value;
};

export const changeLanguageAction = createAction<
  ActionMap[typeof ActionType.changeLanguage]
>(ActionType.changeLanguage);

const changeLanguage: ReducerType<typeof ActionType.changeLanguage> = (
  { settings },
  { payload: { value } }
) => {
  if (hasLanguage(value)) {
    settings.language = value;
  }
};

export const changeTableNameCaseAction = createAction<
  ActionMap[typeof ActionType.changeTableNameCase]
>(ActionType.changeTableNameCase);

const changeTableNameCase: ReducerType<
  typeof ActionType.changeTableNameCase
> = ({ settings }, { payload: { value } }) => {
  if (hasNameCase(value)) {
    settings.tableNameCase = value;
  }
};

export const changeColumnNameCaseAction = createAction<
  ActionMap[typeof ActionType.changeColumnNameCase]
>(ActionType.changeColumnNameCase);

const changeColumnNameCase: ReducerType<
  typeof ActionType.changeColumnNameCase
> = ({ settings }, { payload: { value } }) => {
  if (hasNameCase(value)) {
    settings.columnNameCase = value;
  }
};

export const changeBracketTypeAction = createAction<
  ActionMap[typeof ActionType.changeBracketType]
>(ActionType.changeBracketType);

const changeBracketType: ReducerType<typeof ActionType.changeBracketType> = (
  { settings },
  { payload: { value } }
) => {
  if (hasBracketType(value)) {
    settings.bracketType = value;
  }
};

export const changeRelationshipDataTypeSyncAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipDataTypeSync]
>(ActionType.changeRelationshipDataTypeSync);

const changeRelationshipDataTypeSync: ReducerType<
  typeof ActionType.changeRelationshipDataTypeSync
> = ({ settings }, { payload: { value } }) => {
  settings.relationshipDataTypeSync = value;
};

export const changeRelationshipOptimizationAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipOptimization]
>(ActionType.changeRelationshipOptimization);

const changeRelationshipOptimization: ReducerType<
  typeof ActionType.changeRelationshipOptimization
> = ({ settings }, { payload: { value } }) => {
  settings.relationshipOptimization = value;
};

export const changeColumnOrderAction = createAction<
  ActionMap[typeof ActionType.changeColumnOrder]
>(ActionType.changeColumnOrder);

const changeColumnOrder: ReducerType<typeof ActionType.changeColumnOrder> = (
  { settings },
  { payload: { value, target } }
) => {
  if (value === target || !hasColumnType(value) || !hasColumnType(target)) {
    return;
  }

  const index = settings.columnOrder.indexOf(value);
  const targetIndex = settings.columnOrder.indexOf(target);
  if (index === -1 || targetIndex === -1) {
    return;
  }

  settings.columnOrder.splice(index, 1);
  settings.columnOrder.splice(targetIndex, 0, value);
};

export const changeMaxWidthCommentAction = createAction<
  ActionMap[typeof ActionType.changeMaxWidthComment]
>(ActionType.changeMaxWidthComment);

const changeMaxWidthComment: ReducerType<
  typeof ActionType.changeMaxWidthComment
> = ({ settings }, { payload: { value } }) => {
  settings.maxWidthComment =
    value === -1 ? value : maxWidthCommentInRange(value);
};

export const changeIgnoreSaveSettingsAction = createAction<
  ActionMap[typeof ActionType.changeIgnoreSaveSettings]
>(ActionType.changeIgnoreSaveSettings);

const changeIgnoreSaveSettings: ReducerType<
  typeof ActionType.changeIgnoreSaveSettings
> = ({ settings }, { payload: { saveSettingType, value } }) => {
  settings.ignoreSaveSettings = value
    ? settings.ignoreSaveSettings | saveSettingType
    : settings.ignoreSaveSettings & ~saveSettingType;
};

export const settingsReducers = {
  [ActionType.changeDatabaseName]: changeDatabaseName,
  [ActionType.resize]: resize,
  [ActionType.changeZoomLevel]: changeZoomLevel,
  [ActionType.streamZoomLevel]: streamZoomLevel,
  [ActionType.scrollTo]: scrollTo,
  [ActionType.streamScrollTo]: streamScrollTo,
  [ActionType.changeShow]: changeShow,
  [ActionType.changeDatabase]: changeDatabase,
  [ActionType.changeCanvasType]: changeCanvasType,
  [ActionType.changeLanguage]: changeLanguage,
  [ActionType.changeTableNameCase]: changeTableNameCase,
  [ActionType.changeColumnNameCase]: changeColumnNameCase,
  [ActionType.changeBracketType]: changeBracketType,
  [ActionType.changeRelationshipDataTypeSync]: changeRelationshipDataTypeSync,
  [ActionType.changeRelationshipOptimization]: changeRelationshipOptimization,
  [ActionType.changeColumnOrder]: changeColumnOrder,
  [ActionType.changeMaxWidthComment]: changeMaxWidthComment,
  [ActionType.changeIgnoreSaveSettings]: changeIgnoreSaveSettings,
};

export const actions = {
  changeDatabaseNameAction,
  resizeAction,
  changeZoomLevelAction,
  streamZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  changeShowAction,
  changeDatabaseAction,
  changeCanvasTypeAction,
  changeLanguageAction,
  changeTableNameCaseAction,
  changeColumnNameCaseAction,
  changeBracketTypeAction,
  changeRelationshipDataTypeSyncAction,
  changeRelationshipOptimizationAction,
  changeColumnOrderAction,
  changeMaxWidthCommentAction,
  changeIgnoreSaveSettingsAction,
};
