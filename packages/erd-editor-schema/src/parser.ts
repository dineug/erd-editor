import { pick } from 'lodash-es';

import { v2ToV3 } from '@/convert';
import { schemaV2Parser } from '@/v2';
import { type ERDEditorSchemaV3, schemaV3Parser } from '@/v3';

export function parser(source: string): ERDEditorSchemaV3 {
  const json = JSON.parse(source);
  const version = Reflect.get(json, 'version');

  return version === '3.0.0'
    ? schemaV3Parser(json)
    : v2ToV3(schemaV2Parser(json));
}

export function toJson(schemaV3: ERDEditorSchemaV3) {
  const source = pick(schemaV3, [
    'version',
    'settings',
    'doc',
    'collections',
    'lww',
  ]);
  return JSON.stringify(source, null, 2);
}
