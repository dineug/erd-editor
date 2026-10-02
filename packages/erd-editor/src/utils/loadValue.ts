import { createSchema, toJson } from '@dineug/erd-editor-schema';
import { isEmpty } from 'es-toolkit/compat';

import { toSafeString } from '@/utils/validation';

/**
 * The text a load parses, trimmed. An empty one, a new file's, is a document
 * created from nothing, written out in full so every peer replaying the load
 * reads that document, a released one included, which cannot parse nothing.
 */
export function toLoadValue(value: unknown): string {
  const safeValue = toSafeString(value);
  return isEmpty(safeValue) ? toJson(createSchema()) : safeValue;
}
