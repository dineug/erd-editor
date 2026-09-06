import { pick } from 'es-toolkit';

import { v2ToV3, v3ToV2 } from '@/convert';
import { bHas } from '@/utils/bit';
import { type ERDEditorSchemaV2, schemaV2Parser } from '@/v2';
import {
  type ERDEditorSchemaV3,
  SchemaV3Constants,
  schemaV3Parser,
} from '@/v3';

export function parser(source: string): ERDEditorSchemaV3 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  return version === '3.0.0'
    ? schemaV3Parser(json)
    : v2ToV3(schemaV2Parser(json));
}

export function toJson(schemaV3: ERDEditorSchemaV3) {
  const source = pick(schemaV3, [
    '$schema',
    'version',
    'settings',
    'doc',
    'collections',
  ]);
  const settings = { ...source.settings };
  source.settings = settings;

  if (
    bHas(settings.ignoreSaveSettings, SchemaV3Constants.SaveSettingType.scroll)
  ) {
    settings.originX = 0;
    settings.originY = 0;
  }

  if (
    bHas(
      settings.ignoreSaveSettings,
      SchemaV3Constants.SaveSettingType.zoomLevel
    )
  ) {
    settings.zoomLevel = 1;
  }

  return JSON.stringify(source, null, 2);
}

export function parserV2(source: string): ERDEditorSchemaV2 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  return version === '3.0.0'
    ? v3ToV2(schemaV3Parser(json))
    : schemaV2Parser(json);
}
