import { decodeBase64, encodeBase64 } from '@/core/helper';
import { DataType, Template } from '@/core/indexedDB';

export interface JsonFormat {
  dataTypes: DataType[];
  templates: Template[];
}

export const createJsonFormat = (
  dataTypes: DataType[],
  templates: Template[]
): JsonFormat => ({ dataTypes, templates });

export const createSerialization = (data: JsonFormat) =>
  encodeBase64(JSON.stringify(data));

export const createDeserialization = (value: string): JsonFormat =>
  JSON.parse(decodeBase64(value));
