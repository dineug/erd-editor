import { expect, test } from 'vitest';

import { schemaSQLParser } from './index';

test('WIP...', () => {
  schemaSQLParser(`
CREATE TABLE a (
  b bigint
)
  `);
});
