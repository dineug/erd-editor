import { isSettingLocked } from '@dineug/erd-editor-schema';
import { isNil, pick } from 'es-toolkit';

import { LockSettingType, LockSettingTypeList } from '@/constants/schema';
import type {
  Editor,
  ScreenUnit,
  ScreenViewport,
} from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';

import { CodeSettingLocks } from './actions';

type Settings = RootState['settings'];

/** A unit that holds one setting alone, every unit but the viewport. */
export type ScreenSettingUnit = Exclude<ScreenUnit, 'viewport'>;

/** What a write of a one-setting unit lands in: the screen or the baseline. */
type SettingTarget = Partial<Pick<Settings, ScreenSettingUnit>>;

const VIEWPORT_FIELDS = ['originX', 'originY', 'zoomLevel'] as const;

/** Whether a write is a readonly reader's turn of its own screen. */
export const isScreenWrite = (tags?: number): boolean =>
  !isNil(tags) && bHas(tags, Tag.screen);

/** Whether a write is a peer's, or a follow of one. */
export const isRemoteWrite = (tags?: number): boolean =>
  !isNil(tags) && (bHas(tags, Tag.shared) || bHas(tags, Tag.following));

/** Whether the store holds the document's value of the unit under its screen. */
const hasScreenBaseline = (editor: Editor, unit: ScreenUnit): boolean =>
  !isNil(editor.screenBaseline?.[unit]);

/**
 * Keeps the document's value of a unit aside before a screen turn writes
 * over it, once: a later turn of the same unit keeps the first value.
 */
export function keepScreenBaseline(state: RootState, unit: ScreenUnit): void {
  const { editor, settings } = state;
  if (hasScreenBaseline(editor, unit)) return;
  if (!editor.screenBaseline) editor.screenBaseline = {};

  const baseline = editor.screenBaseline;
  if (unit === 'viewport') {
    baseline.viewport = pick(settings, VIEWPORT_FIELDS);
  } else {
    holdSetting(baseline, settings, unit);
  }
}

/** Drops the units named from the baseline, so the screen stands for the document again. */
export function endScreenBaseline(
  editor: Editor,
  ...units: ScreenUnit[]
): void {
  const baseline = editor.screenBaseline;
  if (!baseline) return;

  units.forEach(unit => Reflect.deleteProperty(baseline, unit));
  if (Object.keys(baseline).length === 0) {
    editor.screenBaseline = null;
  }
}

function holdSetting<U extends ScreenSettingUnit>(
  target: SettingTarget,
  source: SettingTarget,
  unit: U
): void {
  target[unit] = source[unit];
}

/**
 * Where a write of a one-setting unit lands: a screen turn keeps the baseline
 * and writes the screen, a peer's write lands in a baseline held, and the
 * reader's own write drops the baseline and writes the screen.
 */
export function settingWriteTarget(
  state: RootState,
  tags: number | undefined,
  unit: ScreenSettingUnit
): SettingTarget {
  const { editor, settings } = state;
  if (isScreenWrite(tags)) {
    keepScreenBaseline(state, unit);
  } else if (!isRemoteWrite(tags)) {
    endScreenBaseline(editor, unit);
  } else if (editor.screenBaseline && hasScreenBaseline(editor, unit)) {
    return editor.screenBaseline;
  }
  return settings;
}

/**
 * Where a scroll or a zoom lands, by the same rule, the three placement
 * fields one unit: any of the four writes keeps or drops the whole viewport.
 */
export function viewportWriteTarget(
  state: RootState,
  tags: number | undefined
): ScreenViewport {
  const { editor, settings } = state;
  if (isScreenWrite(tags)) {
    keepScreenBaseline(state, 'viewport');
  } else if (!isRemoteWrite(tags)) {
    endScreenBaseline(editor, 'viewport');
  }
  return (isRemoteWrite(tags) && editor.screenBaseline?.viewport) || settings;
}

/** The lock each one-setting unit a load may keep answers to; show and the database have none. */
const UNIT_LOCKS: Partial<
  Record<ScreenSettingUnit, (typeof LockSettingTypeList)[number]>
> = {
  canvasType: LockSettingType.canvasType,
  nameViewMode: LockSettingType.unlockNameViewMode,
  ...CodeSettingLocks,
};

const LOAD_HELD_UNITS: ReadonlyArray<ScreenSettingUnit> = [
  'canvasType',
  'show',
  'database',
  'language',
  'tableNameCase',
  'columnNameCase',
  'bracketType',
];

const isUnitLocked = (settings: Settings, unit: ScreenSettingUnit): boolean => {
  const lock = UNIT_LOCKS[unit];
  return !isNil(lock) && isSettingLocked(settings.lockSettings, lock);
};

/**
 * Lands a replacing load on the baseline, the screen as it stood before. Any
 * load ends the viewport and an unlocked name view and keeps a locked unit, as
 * a replica keeps its value; a peer's holds the rest, the reader's own ends it.
 */
export function landScreenBaseline(
  state: RootState,
  screen: SettingTarget,
  tags: number | undefined
): void {
  const { editor, settings } = state;
  const baseline = editor.screenBaseline;
  if (!baseline) return;

  const ended: ScreenUnit[] = ['viewport'];
  if (!isUnitLocked(settings, 'nameViewMode')) ended.push('nameViewMode');

  // A peer's load keeps the screen of an unlocked unit, the loaded value held
  // beneath it; the reader's own load shows what it loaded, as it always did.
  LOAD_HELD_UNITS.forEach(unit => {
    if (!hasScreenBaseline(editor, unit) || isUnitLocked(settings, unit)) {
      return;
    }
    if (isRemoteWrite(tags)) {
      holdSetting(baseline, settings, unit);
      holdSetting(settings, screen, unit);
    } else {
      ended.push(unit);
    }
  });
  endScreenBaseline(editor, ...ended);
}
