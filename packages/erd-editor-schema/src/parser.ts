import { pick } from 'es-toolkit';

import { v2ToV3, v3ToV2 } from '@/convert';
import { bHas } from '@/utils/bit';
import { type ERDEditorSchemaV2, schemaV2Parser } from '@/v2';
import {
  type ERDEditorSchemaV3,
  SchemaV3Constants,
  schemaV3Parser,
} from '@/v3';
import { resetPreLockView } from '@/v3/parser/settings';

export function parser(source: string): ERDEditorSchemaV3 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  if (version === '3.0.0') return schemaV3Parser(json);

  const schema = v2ToV3(schemaV2Parser(json));
  resetPreLockView(schema.settings);
  return schema;
}

/**
 * The document as its file holds it: each locked setting at its lock, every
 * other as it stands, the locked values left out, the save switches of older
 * releases read off the viewport, and the scripts only while one holds text.
 */
export function toJson(schemaV3: ERDEditorSchemaV3) {
  const source = pick(schemaV3, [
    '$schema',
    'version',
    'settings',
    'doc',
    'collections',
  ]);
  const { lockedValues, lockSettings, ddlScripts, ...rest } = source.settings;
  const { LockSettingFields, LockSettingType, LockSettingTypeList } =
    SchemaV3Constants;
  const { scroll, zoomLevel } = SchemaV3Constants.SaveSettingType;
  const settings = {
    ...rest,
    ignoreSaveSettings: bHas(lockSettings, LockSettingType.viewport)
      ? scroll | zoomLevel
      : 0,
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

  return JSON.stringify({ ...source, settings }, null, 2);
}

export function parserV2(source: string): ERDEditorSchemaV2 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  return version === '3.0.0'
    ? v3ToV2(schemaV3Parser(json))
    : schemaV2Parser(json);
}
