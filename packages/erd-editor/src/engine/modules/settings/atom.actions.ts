import { replaceOperator } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { clamp, isNil } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import { Viewport } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { Point } from '@/internal-types';
import { getFrozenOrigin, getViewContentRect } from '@/konva/scene/viewFreeze';
import { bHas } from '@/utils/bit';
import {
  hasBracketType,
  hasColumnType,
  hasDatabase,
  hasLanguage,
  hasNameCase,
  maxWidthCommentInRange,
  zoomLevelInRange,
} from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';
import {
  contentScrollRange,
  openingOrigin,
  type ScrollRange,
} from './scrollRange';

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

/** No travel at all, standing where the origin is: the bars hide over it. */
const still = (origin: number): ScrollRange => ({ min: origin, max: origin });

/** Whether the host has measured a screen; a hidden one and a headless replica report none. */
export const hasViewport = ({ width, height }: Viewport): boolean =>
  width > 0 && height > 0;

/**
 * The travel the content alone allows on each axis: from the content's far
 * edge meeting the near edge of the screen to its near edge meeting the far
 * one. An empty document and an unmeasured screen have no travel to offer.
 */
export function getContentScrollRanges(state: RootState): ScrollRanges {
  const {
    settings: { originX, originY, zoomLevel },
    editor: { viewport },
  } = state;
  const content = getViewContentRect(state);

  if (!content || !hasViewport(viewport)) {
    return { left: still(originX), top: still(originY) };
  }

  return {
    left: contentScrollRange(
      content.x,
      content.x + content.width,
      viewport.width,
      zoomLevel
    ),
    top: contentScrollRange(
      content.y,
      content.y + content.height,
      viewport.height,
      zoomLevel
    ),
  };
}

/**
 * The origin a load settles on: kept where the file put it while any of the
 * content is drawn there, else pulled to where a screen's worth of it, or all
 * of it, is. An empty document and an unmeasured screen leave it as it is.
 */
export function getOpeningOrigin(state: RootState): Point {
  const {
    settings: { originX, originY, zoomLevel },
    editor: { viewport },
  } = state;
  const content = getViewContentRect(state);

  if (!content || !hasViewport(viewport)) {
    return { x: originX, y: originY };
  }

  return {
    x: openingOrigin(
      originX,
      content.x,
      content.x + content.width,
      viewport.width,
      zoomLevel
    ),
    y: openingOrigin(
      originY,
      content.y,
      content.y + content.height,
      viewport.height,
      zoomLevel
    ),
  };
}

/** The range widened to hold every origin named, so none of them lies outside it. */
const hull = (range: ScrollRange, ...origins: number[]): ScrollRange => ({
  min: Math.min(range.min, ...origins),
  max: Math.max(range.max, ...origins),
});

/**
 * The travel every aid is drawn from and the two drags are gated by: the
 * content's own range widened to hold the origin where it stands and, while a
 * drag holds the view, the origin it started from, so it never shifts under the drag.
 */
export function getScrollRanges(state: RootState): ScrollRanges {
  const { originX, originY } = state.settings;
  const { left, top } = getContentScrollRanges(state);
  const anchor = getFrozenOrigin(state);

  return anchor
    ? { left: hull(left, originX, anchor.x), top: hull(top, originY, anchor.y) }
    : { left: hull(left, originX), top: hull(top, originY) };
}

export type ScrollMovement = ActionMap[typeof ActionType.streamScrollTo];

/**
 * The step of a thumb or handle drag cut to the hull it is drawn over, so the
 * origin lands on the end of the travel rather than a step past it. An
 * unmeasured screen has no travel to cut against and hands the step back as it is.
 */
export function clampScrollMovement(
  state: RootState,
  { movementX, movementY }: ScrollMovement
): ScrollMovement {
  if (!hasViewport(state.editor.viewport)) {
    return { movementX, movementY };
  }

  const { originX, originY } = state.settings;
  const { left, top } = getScrollRanges(state);

  return {
    movementX: clamp(originX + movementX, left.min, left.max) - originX,
    movementY: clamp(originY + movementY, top.min, top.max) - originY,
  };
}

export const scrollToAction = createAction<
  ActionMap[typeof ActionType.scrollTo]
>(ActionType.scrollTo);

/**
 * An absolute request is honoured as it stands: the minimap, a jump to a table,
 * a zoom keeping its centre and a replayed history entry each name the origin
 * they mean, and the range widens to hold it rather than the request bending.
 */
const scrollTo: ReducerType<typeof ActionType.scrollTo> = (
  { settings },
  { payload: { originX, originY }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.originX = round(originX, 4);
  settings.originY = round(originY, 4);
};

export const streamScrollToAction = createAction<
  ActionMap[typeof ActionType.streamScrollTo]
>(ActionType.streamScrollTo);

/**
 * A step of a gesture, taken as it is: the wheel, the grab and the touch pan
 * go anywhere, since an infinite canvas has no edge, and the hull the aids are
 * drawn from follows the origin out rather than holding it back.
 */
const streamScrollTo: ReducerType<typeof ActionType.streamScrollTo> = (
  { settings },
  { payload: { movementX, movementY }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  settings.originX = round(settings.originX + movementX, 4);
  settings.originY = round(settings.originY + movementY, 4);
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
