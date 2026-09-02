import { replaceOperator } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { createInRange, isNill } from '@dineug/shared';
import { round } from 'es-toolkit/compat';

import { Viewport } from '@/engine/modules/editor/state';
import { Tag } from '@/engine/tag';
import { Settings } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { getZoomViewport } from '@/utils/dragSelect';
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
  if (!isNill(tags) && bHas(tags, Tag.following)) {
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
  if (!isNill(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.zoomLevel = zoomLevelInRange(settings.zoomLevel + value);
};

/** A zoom of exactly 1 negates a zero offset, and the store compares with Object.is. */
const unsigned = (value: number) => value + 0;

/** How far the scroll may travel on one axis, measured in screen pixels. */
export type ScrollRange = {
  min: number;
  max: number;
};

export type ScrollRanges = {
  left: ScrollRange;
  top: ScrollRange;
};

/** The canvas box and the zoom that draws it, which is all a range needs. */
export type ScrollTransform = Pick<Settings, 'width' | 'height' | 'zoomLevel'>;

/**
 * One axis of travel: the canvas box, widened by whatever a magnifying zoom
 * draws past it. Shrinking never narrows it, so an offset survives a trip down
 * to the zoom floor and back instead of being clamped onto the midpoint.
 */
function toScrollRange(
  size: number,
  drawn: number,
  offset: number,
  viewportLength: number
): ScrollRange {
  return {
    min: unsigned(
      Math.min(viewportLength - size, viewportLength - drawn - offset)
    ),
    max: unsigned(Math.max(0, -offset)),
  };
}

/**
 * How far the scroll may travel on each axis. A scene layer sits at the scroll
 * plus the zoom viewport offset, so magnifying reaches further both ways, while
 * shrinking leaves the travel the unzoomed canvas box already had.
 */
export function getScrollRanges(
  settings: ScrollTransform,
  viewport: Viewport
): ScrollRanges {
  const { x, y, w, h } = getZoomViewport(
    settings.width,
    settings.height,
    settings.zoomLevel
  );

  return {
    left: toScrollRange(settings.width, w, x, viewport.width),
    top: toScrollRange(settings.height, h, y, viewport.height),
  };
}

/** The clamps every reducer that writes a scroll offset shares. */
export function createScrollInRange(
  settings: ScrollTransform,
  viewport: Viewport
) {
  const { left, top } = getScrollRanges(settings, viewport);

  return {
    scrollLeftInRange: createInRange(left.min, left.max),
    scrollTopInRange: createInRange(top.min, top.max),
  };
}

export const scrollToAction = createAction<
  ActionMap[typeof ActionType.scrollTo]
>(ActionType.scrollTo);

const scrollTo: ReducerType<typeof ActionType.scrollTo> = (
  { settings, editor: { viewport } },
  { payload: { scrollTop, scrollLeft }, tags }
) => {
  if (!isNill(tags) && bHas(tags, Tag.following)) {
    return;
  }

  const { scrollTopInRange, scrollLeftInRange } = createScrollInRange(
    settings,
    viewport
  );

  settings.scrollTop = round(scrollTopInRange(scrollTop), 4);
  settings.scrollLeft = round(scrollLeftInRange(scrollLeft), 4);
};

export const streamScrollToAction = createAction<
  ActionMap[typeof ActionType.streamScrollTo]
>(ActionType.streamScrollTo);

const streamScrollTo: ReducerType<typeof ActionType.streamScrollTo> = (
  { settings, editor: { viewport } },
  { payload: { movementX, movementY }, tags }
) => {
  if (!isNill(tags) && bHas(tags, Tag.following)) {
    return;
  }

  const { scrollTopInRange, scrollLeftInRange } = createScrollInRange(
    settings,
    viewport
  );

  settings.scrollTop = round(
    scrollTopInRange(settings.scrollTop + movementY),
    4
  );
  settings.scrollLeft = round(
    scrollLeftInRange(settings.scrollLeft + movementX),
    4
  );
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
  if (!isNill(tags) && bHas(tags, Tag.following)) {
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
