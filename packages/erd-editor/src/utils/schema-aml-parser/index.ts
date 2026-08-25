import {
  ERDEditorSchemaV3,
  schemaV3Parser,
  toJson,
} from '@dineug/erd-editor-schema';

import { EngineContext } from '@/engine/context';
import { canvasSizeInRange } from '@/utils/validation';

import { convertToSchema } from './convert';
import { parseAMLModel } from './parser';
import { AMLModel } from './types';

const EMPTY_MODEL: AMLModel = {
  entities: [],
  relations: [],
  types: {},
  skipped: [],
};

export function schemaAMLParserToSchemaJson(
  aml: string,
  ctx: EngineContext,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3
): string {
  const result = parseAMLModel(aml);
  const model = result.ok ? result.model : EMPTY_MODEL;
  const schema = schemaV3Parser({});
  const canvasSize = canvasSizeInRange(model.entities.length * 100);
  schema.settings.width = canvasSize;
  schema.settings.height = canvasSize;

  // The editor's dialect reaches this function through `prepare`, and
  // `resolveDataType` needs it before the first column is created.
  const { settings } = prepare ? prepare(schema) : schema;
  const converted = convertToSchema(model, ctx, settings.database);
  converted.settings = settings;

  return toJson(converted);
}
