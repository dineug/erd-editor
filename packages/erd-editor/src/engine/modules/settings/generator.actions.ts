import { AnyAction } from '@dineug/r-html';
import { isNil, pick } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import {
  CanvasType,
  LockSettingFields,
  LockSettingTypeList,
} from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import { endScreenSettingsAction } from '@/engine/modules/editor/atom.actions';
import {
  viewChangeZoomLevelAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { RootState } from '@/engine/state';
import { attachActionsTag, Tag } from '@/engine/tag';
import { Point } from '@/internal-types';
import {
  getZoomTransform,
  type SceneTransform,
  toScenePoint,
  toScreenPoint,
} from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { zoomLevelInRange } from '@/utils/validation';

import {
  changeBracketTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
  UnlockCarriedSettings,
} from './atom.actions';
import type { ScreenSettingUnit } from './screenBaseline';

/**
 * How far the scroll has to travel for the scene point given to land under the
 * screen point given once the zoom changes, solved with the placement given.
 */
function getMovementToPlace(
  transform: SceneTransform,
  nextZoomLevel: number,
  scene: Point,
  screen: Point
) {
  const landed = toScreenPoint(
    { ...transform, zoomLevel: nextZoomLevel },
    scene
  );

  return {
    movementX: round(screen.x - landed.x, 4),
    movementY: round(screen.y - landed.y, 4),
  };
}

/**
 * How far the scroll has to travel for the scene point under the middle of the
 * screen to stay under it, solved with the placement given.
 */
function getMovementScrollTo(
  state: RootState,
  transform: SceneTransform,
  nextZoomLevel: number
) {
  const { viewport } = state.editor;
  const center = { x: viewport.width / 2, y: viewport.height / 2 };

  return getMovementToPlace(
    transform,
    nextZoomLevel,
    toScenePoint(transform, center),
    center
  );
}

/** The origin it adds the movement to is the one getMovementScrollTo solved against. */
export const changeZoomLevelAction$ = (
  value: number,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = getZoomTransform(state, source);
    const { originX, originY } = transform;
    const nextZoomLevel = zoomLevelInRange(value);
    const { movementX, movementY } = getMovementScrollTo(
      state,
      transform,
      nextZoomLevel
    );
    const origin = {
      originX: originX + movementX,
      originY: originY + movementY,
    };

    if (source && source !== 'document') {
      yield viewChangeZoomLevelAction({ value, kind: source });
      yield viewScrollToAction({ ...origin, kind: source });
      return;
    }

    yield changeZoomLevelAction({ value });
    yield scrollToAction(origin);
  };

export const streamZoomLevelAction$ = (
  value: number,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = getZoomTransform(state, source);
    const nextZoomLevel = zoomLevelInRange(transform.zoomLevel + value);
    const movement = getMovementScrollTo(state, transform, nextZoomLevel);

    if (source && source !== 'document') {
      yield viewStreamZoomLevelAction({ value, kind: source });
      yield viewStreamScrollToAction({ ...movement, kind: source });
      return;
    }

    yield streamZoomLevelAction({ value });
    yield streamScrollToAction(movement);
  };

export type PinchZoom = {
  /** The zoom the pinch has reached, which the store rounds as it lands. */
  zoomLevel: number;
  /** Where the pinch is centred now, in the scene box. */
  screen: Point;
  /** The scene point the pinch holds, else the one under screen. */
  scene?: Point;
};

/**
 * A step of a pinch: the zoom it has reached, with the scene point it holds put
 * under where it is centred now, so two fingers zoom about their midpoint and
 * pan as it travels. Streamed, so a whole pinch is one undo entry as a wheel is.
 */
export const pinchZoomAction$ = (
  { zoomLevel, screen, scene }: PinchZoom,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = getZoomTransform(state, source);
    const nextZoomLevel = zoomLevelInRange(zoomLevel);
    const value = round(nextZoomLevel - transform.zoomLevel, 2);
    const movement = getMovementToPlace(
      transform,
      nextZoomLevel,
      scene ?? toScenePoint(transform, screen),
      screen
    );

    const kind = source && source !== 'document' ? source : null;

    // Only what moved, so a pinch that stands still pushes no undo entry.
    if (value !== 0) {
      yield kind
        ? viewStreamZoomLevelAction({ value, kind })
        : streamZoomLevelAction({ value });
    }
    if (movement.movementX !== 0 || movement.movementY !== 0) {
      yield kind
        ? viewStreamScrollToAction({ ...movement, kind })
        : streamScrollToAction(movement);
    }
  };

/**
 * Locks the settings named at what they hold now, or unlocks them carrying the
 * code settings and the name view among them as they show here. A canvas type
 * locked on the Settings tab holds the tab the reader came from.
 */
export const changeLockSettingsAction$ = (
  lockSettingType: number,
  value: boolean
): GeneratorAction =>
  function* ({ settings, editor }) {
    const named = value
      ? lockSettingType
      : lockSettingType & UnlockCarriedSettings;
    const fields = LockSettingTypeList.filter(bit => bHas(named, bit)).flatMap(
      bit => LockSettingFields[bit]
    );
    const values: Partial<RootState['settings']['lockedValues']> = pick(
      settings,
      fields
    );

    if (values.canvasType === CanvasType.settings) {
      values.canvasType = editor.lastCanvasType;
    }

    yield changeLockSettingsAction({ lockSettingType, value, values });
  };

/** The setter each setting a writable screen takes back sends its value through. */
const RESTORED_SETTERS = {
  language: changeLanguageAction,
  tableNameCase: changeTableNameCaseAction,
  columnNameCase: changeColumnNameCaseAction,
  bracketType: changeBracketTypeAction,
  database: changeDatabaseAction,
} as const;

const RESTORED_UNITS: ReadonlyArray<ScreenSettingUnit> = [
  ...(Object.keys(RESTORED_SETTERS) as ScreenSettingUnit[]),
  'show',
];

/**
 * The setters that bring each code setting, the database and the show bits the
 * values name from what the settings hold to those values, untagged; a unit the
 * values leave out, and one the settings already hold, sends none.
 */
export function screenSettingRestores(
  values: Partial<Pick<RootState['settings'], ScreenSettingUnit>>,
  settings: RootState['settings']
): AnyAction[] {
  const restores: AnyAction[] = [];
  Object.entries(RESTORED_SETTERS).forEach(([unit, setter]) => {
    const value = values[unit as keyof typeof RESTORED_SETTERS];
    if (!isNil(value) && value !== settings[unit as ScreenSettingUnit]) {
      restores.push(setter({ value }));
    }
  });

  // The bits the values hold and the settings lack come back set, and those the
  // settings hold alone come back cleared, each as one change, so every listener
  // of a show change hears it.
  const { show } = values;
  if (!isNil(show)) {
    const set = show & ~settings.show;
    const clear = settings.show & ~show;
    if (set) restores.push(changeShowAction({ show: set, value: true }));
    if (clear) restores.push(changeShowAction({ show: clear, value: false }));
  }
  return restores;
}

/**
 * What a readonly editor turning writable sends in one batch: the document's
 * code settings, database and show bits back on the screen through their own
 * setters, tagged as the screen's, then the end of their baseline.
 */
export const restoreScreenSettingsAction$ = (): GeneratorAction =>
  function* ({ editor: { screenBaseline }, settings }) {
    const units = RESTORED_UNITS.filter(unit => !isNil(screenBaseline?.[unit]));
    if (!screenBaseline || !units.length) return;

    yield [
      ...attachActionsTag(
        Tag.screen,
        screenSettingRestores(screenBaseline, settings)
      ),
      endScreenSettingsAction({ units }),
    ];
  };

export const actions$ = {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
  changeLockSettingsAction$,
};
