import { pick } from 'es-toolkit';

import { bHas } from '@/utils/bit';
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
 * its lock, every other as it stands, the locked values left out, the scripts
 * only while one of them holds text.
 */
export function normalizeSettings(source: Settings): NormalizedSettings {
  const { lockedValues, lockSettings, ddlScripts, ...rest } = source;
  const settings: NormalizedSettings = {
    ...rest,
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
