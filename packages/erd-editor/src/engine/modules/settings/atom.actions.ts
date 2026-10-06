import { replaceOperator } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { clamp, isNil, isNumber, pick } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import {
  CanvasType,
  LockSettingFields,
  LockSettingType,
  LockSettingTypeList,
} from '@/constants/schema';
import { Viewport } from '@/engine/modules/editor/state';
import {
  viewScrollToAction,
  viewStreamScrollToAction,
} from '@/engine/modules/editor/view.actions';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { Point } from '@/internal-types';
import { getFrozenOrigin, getViewContentRect } from '@/konva/scene/viewFreeze';
import { getSceneTransform } from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import {
  hasBracketType,
  hasCanvasType,
  hasColumnType,
  hasDatabase,
  hasLanguage,
  hasNameCase,
  maxWidthCommentInRange,
  zoomInRange,
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
export function getContentScrollRanges(
  state: RootState,
  source: GeometrySource = 'document'
): ScrollRanges {
  const { originX, originY, zoomLevel } = getSceneTransform(state, source);
  const { viewport } = state.editor;
  const content = getViewContentRect(state, source);

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
export function getScrollRanges(
  state: RootState,
  source: GeometrySource = 'document'
): ScrollRanges {
  const { originX, originY } = getSceneTransform(state, source);
  const { left, top } = getContentScrollRanges(state, source);
  const anchor = getFrozenOrigin(state, source);

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
  { movementX, movementY }: ScrollMovement,
  source: GeometrySource = 'document'
): ScrollMovement {
  if (!hasViewport(state.editor.viewport)) {
    return { movementX, movementY };
  }

  const { originX, originY } = getSceneTransform(state, source);
  const { left, top } = getScrollRanges(state, source);

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

/**
 * The scroll a scene dispatches lands where that scene reads: the document's
 * own for the document scene, and the view of the source's kind, named, for a
 * view scene, so neither of two scenes on one page ever scrolls the other.
 */
export const sceneScrollToAction = (
  source: GeometrySource,
  payload: ActionMap[typeof ActionType.scrollTo]
) =>
  source === 'document'
    ? scrollToAction(payload)
    : viewScrollToAction({ ...payload, kind: source });

export const sceneStreamScrollToAction = (
  source: GeometrySource,
  payload: ScrollMovement
) =>
  source === 'document'
    ? streamScrollToAction(payload)
    : viewStreamScrollToAction({ ...payload, kind: source });

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

/** The tab the reader stands on, which a canvas type lock taken on Settings holds. */
export function rememberCanvasType({ settings, editor }: RootState): void {
  if (settings.canvasType !== CanvasType.settings) {
    editor.lastCanvasType = settings.canvasType;
  }
}

export const changeCanvasTypeAction = createAction<
  ActionMap[typeof ActionType.changeCanvasType]
>(ActionType.changeCanvasType);

const changeCanvasType: ReducerType<typeof ActionType.changeCanvasType> = (
  state,
  { payload: { value }, tags }
) => {
  if (!isNil(tags) && bHas(tags, Tag.following)) {
    return;
  }

  rememberCanvasType(state);
  state.settings.canvasType = value;
};

export const changeLanguageAction = createAction<
  ActionMap[typeof ActionType.changeLanguage]
>(ActionType.changeLanguage);

type CodeSetting =
  | 'language'
  | 'tableNameCase'
  | 'columnNameCase'
  | 'bracketType';

/**
 * Writes a code setting through its register, so the latest setter or unlock
 * of it wins on every peer, whatever order they arrive in.
 */
function replaceCodeSetting(
  { settings, lww }: RootState,
  version: number,
  field: CodeSetting,
  value: number
) {
  replaceOperator(lww, version, 'settings.code', 'settings', field, () => {
    settings[field] = value;
  });
}

const changeLanguage: ReducerType<typeof ActionType.changeLanguage> = (
  state,
  { payload: { value }, version },
  { clock }
) => {
  if (hasLanguage(value)) {
    replaceCodeSetting(state, version ?? clock.getVersion(), 'language', value);
  }
};

export const changeTableNameCaseAction = createAction<
  ActionMap[typeof ActionType.changeTableNameCase]
>(ActionType.changeTableNameCase);

const changeTableNameCase: ReducerType<
  typeof ActionType.changeTableNameCase
> = (state, { payload: { value }, version }, { clock }) => {
  if (hasNameCase(value)) {
    replaceCodeSetting(
      state,
      version ?? clock.getVersion(),
      'tableNameCase',
      value
    );
  }
};

export const changeColumnNameCaseAction = createAction<
  ActionMap[typeof ActionType.changeColumnNameCase]
>(ActionType.changeColumnNameCase);

const changeColumnNameCase: ReducerType<
  typeof ActionType.changeColumnNameCase
> = (state, { payload: { value }, version }, { clock }) => {
  if (hasNameCase(value)) {
    replaceCodeSetting(
      state,
      version ?? clock.getVersion(),
      'columnNameCase',
      value
    );
  }
};

export const changeBracketTypeAction = createAction<
  ActionMap[typeof ActionType.changeBracketType]
>(ActionType.changeBracketType);

const changeBracketType: ReducerType<typeof ActionType.changeBracketType> = (
  state,
  { payload: { value }, version },
  { clock }
) => {
  if (hasBracketType(value)) {
    replaceCodeSetting(
      state,
      version ?? clock.getVersion(),
      'bracketType',
      value
    );
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

export const changeLockSettingsAction = createAction<
  ActionMap[typeof ActionType.changeLockSettings]
>(ActionType.changeLockSettings);

type LockedValues = RootState['settings']['lockedValues'];

/** What each locked field may hold, as the setter of its setting would take it. */
const isLockedValue: Record<keyof LockedValues, (value: any) => boolean> = {
  originX: Number.isFinite,
  originY: Number.isFinite,
  zoomLevel: value => isNumber(value) && zoomInRange(value) === value,
  canvasType: value => hasCanvasType(value) && value !== CanvasType.settings,
  language: hasLanguage,
  tableNameCase: hasNameCase,
  columnNameCase: hasNameCase,
  bracketType: hasBracketType,
};

/**
 * The locks of the settings every peer shows one screen of, their setters
 * never following-tagged, so an unlock of one carries the unlocker's value.
 */
export const CodeLockSettings =
  LockSettingType.language |
  LockSettingType.tableNameCase |
  LockSettingType.columnNameCase |
  LockSettingType.bracketType;

/**
 * Locks each setting named at the values the payload carries, the last lock
 * or unlock of it winning on every peer, and leaves one sent wrong as it was.
 * An unlock that wins sets each valid code value it carries, as a setter would.
 */
const changeLockSettings: ReducerType<typeof ActionType.changeLockSettings> = (
  state,
  { payload: { lockSettingType, value, values }, version },
  { clock }
) => {
  const { settings, lww } = state;
  const safeVersion = version ?? clock.getVersion();

  LockSettingTypeList.forEach(bit => {
    if (!bHas(lockSettingType, bit)) return;

    const fields = LockSettingFields[bit];
    const carried = pick(values, fields);
    const valid = fields.filter(field => isLockedValue[field](carried[field]));
    if (value && valid.length < fields.length) return;

    replaceOperator(
      lww,
      safeVersion,
      'settings.lockSettings',
      'settings',
      String(bit),
      () => {
        if (value) {
          Object.assign(settings.lockedValues, carried);
          settings.lockSettings |= bit;
          return;
        }

        settings.lockSettings &= ~bit;
        if (!bHas(CodeLockSettings, bit)) return;

        valid.forEach(field =>
          replaceCodeSetting(
            state,
            safeVersion,
            field as CodeSetting,
            carried[field] as number
          )
        );
      }
    );
  });
};

export const changeIgnoreSaveSettingsAction = createAction<
  ActionMap[typeof ActionType.changeIgnoreSaveSettings]
>(ActionType.changeIgnoreSaveSettings);

/**
 * Changes nothing, the locks having replaced the switch. Only a replica takes
 * it (ReplicaActionTypes), so a batch an agent written before the locks sends
 * still gets the save its hub waits on, and the element reports no change.
 */
const changeIgnoreSaveSettings: ReducerType<
  typeof ActionType.changeIgnoreSaveSettings
> = () => {};

/** Every lock this release knows, the rest of lockSettings a later one's. */
const LOCK_KNOWN = LockSettingTypeList.reduce((acc, bit) => acc | bit, 0);

/**
 * Lands the settings of a load that replaces the document: each lock through
 * its register, a bit no lock owns taken from the load as show is, and each
 * setting locked once it lands but the view keeping the screen.
 */
export function landLoadedSettings(
  { settings, lww }: RootState,
  loaded: RootState['settings'],
  version: number
): void {
  const { lockSettings, lockedValues, ...screen } = settings;
  Object.assign(settings, loaded, {
    lockSettings:
      (lockSettings & LOCK_KNOWN) | (loaded.lockSettings & ~LOCK_KNOWN),
    lockedValues: { ...lockedValues },
  });

  LockSettingTypeList.forEach(bit => {
    const fields = LockSettingFields[bit];

    replaceOperator(
      lww,
      version,
      'settings.lockSettings',
      'settings',
      String(bit),
      () => {
        settings.lockSettings = bHas(loaded.lockSettings, bit)
          ? settings.lockSettings | bit
          : settings.lockSettings & ~bit;
        Object.assign(settings.lockedValues, pick(loaded.lockedValues, fields));
      }
    );
    if (bit !== LockSettingType.viewport && bHas(settings.lockSettings, bit)) {
      Object.assign(settings, pick(screen, fields));
    }
  });
}

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
  [ActionType.changeLockSettings]: changeLockSettings,
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
  changeLockSettingsAction,
  changeIgnoreSaveSettingsAction,
};
