import { pick } from 'es-toolkit';

import { bHas } from '@/utils/bit';
import { toSavedColumnOrder } from '@/v3/parser/settings';
import {
  DDLScripts,
  LockSettingFields,
  LockSettingTypeList,
  Settings,
} from '@/v3/schema/settings';

export type NormalizedSettings = Omit<
  Settings,
  'lockedValues' | 'ddlScripts'
> & {
  ddlScripts?: DDLScripts;
};

/**
 * The settings every serialization writes, as a copy: each locked setting at
 * its lock, every other as it stands, the column order in seven entries where
 * it can be, no locked values, the scripts only while one holds text.
 */
export function normalizeSettings(source: Settings): NormalizedSettings {
  const { lockedValues, lockSettings, ddlScripts, ...rest } = source;
  const settings: NormalizedSettings = {
    ...rest,
    columnOrder: toSavedColumnOrder(rest.columnOrder),
    lockSettings,
    ...(ddlScripts && (ddlScripts.before !== '' || ddlScripts.after !== '')
      ? { ddlScripts: { before: ddlScripts.before, after: ddlScripts.after } }
      : {}),
  };

  // A document no parser built, raw JSON say, carries no locked values: its
  // saved fields are what it holds, so they are written as they stand.
  LockSettingTypeList.forEach(lockSettingType => {
    if (lockedValues && bHas(lockSettings, lockSettingType)) {
      Object.assign(
        settings,
        pick(lockedValues, LockSettingFields[lockSettingType])
      );
    }
  });

  return settings;
}
