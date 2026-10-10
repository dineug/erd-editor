import {
  ERDEditorSchemaV3,
  schemaV3Parser,
  toJson,
} from '@dineug/erd-editor-schema';

import { EngineContext } from '@/engine/context';

import { convertToSchema } from './convert';
import { parseDBMLModel } from './parser';
import { DBMLModel } from './types';

const EMPTY_MODEL: DBMLModel = {
  tables: [],
  refs: [],
  tableGroups: [],
  enums: {},
  skipped: [],
};

export function schemaDBMLParserToSchemaJson(
  dbml: string,
  ctx: EngineContext,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): string {
  const result = parseDBMLModel(dbml);
  const model = result.ok ? result.model : EMPTY_MODEL;
  const schema = schemaV3Parser({});

  // The editor's dialect reaches this function through prepare, and
  // resolveDataType needs it before the first column is created.
  const { settings } = prepare ? prepare(schema) : schema;
  const converted = convertToSchema(model, ctx, settings.database);
  converted.settings = settings;

  return toJson(converted);
}
