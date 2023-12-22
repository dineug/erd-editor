import { CreateIndex, Token } from '@@types/index';

import { createIndex } from './create.index';

export function createUniqueIndex(tokens: Token[]): CreateIndex {
  return createIndex(tokens, true);
}
