import { pick } from 'es-toolkit';

import { toSavedColumnOrder } from '@/v3/parser/settings';
import {
  DDLScripts,
  isSettingLocked,
  LockSettingFields,
  LockSettingTypeList,
  NameViewMode,
  Settings,
} from '@/v3/schema/settings';

export type NormalizedSettings = Omit<
  Settings,
  'lockedValues' | 'ddlScripts' | 'nameViewMode'
> & {
  ddlScripts?: DDLScripts;
  nameViewMode?: NameViewMode;
};

/**
 * The settings every serialization writes, as a copy: each locked setting at
 * its lock, every other as it stands, the column order in seven entries where
 * it can be, no locked values, the scripts only while one holds text.
 */
export function normalizeSettings(source: Settings): NormalizedSettings {
  const { lockedValues, lockSettings, ddlScripts, nameViewMode, ...rest } =
    source;
  const settings: NormalizedSettings = {
    ...rest,
    columnOrder: toSavedColumnOrder(rest.columnOrder),
    lockSettings,
    ...(ddlScripts && (ddlScripts.before !== '' || ddlScripts.after !== '')
      ? { ddlScripts: { before: ddlScripts.before, after: ddlScripts.after } }
      : {}),
    ...(nameViewMode === undefined ? {} : { nameViewMode }),
  };

  // A document no parser built, raw JSON say, carries no locked values: its
  // saved fields are what it holds, so no lock writes over them.
  LockSettingTypeList.forEach(lockSettingType => {
    if (lockedValues && isSettingLocked(lockSettings, lockSettingType)) {
      Object.assign(
        settings,
        pick(lockedValues, LockSettingFields[lockSettingType])
      );
    }
  });

  // Written last, and only while not physical, so a file that never showed
  // other names keeps its bytes and the scripts stay right after the locks.
  if (settings.nameViewMode === NameViewMode.physical) {
    delete settings.nameViewMode;
  }

  return settings;
}
