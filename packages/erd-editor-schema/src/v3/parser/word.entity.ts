import { isString } from 'es-toolkit';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Word } from '@/v3/schema/word.entity';

export const createWord = (): Word => ({
  id: '',
  name: '',
  abbreviation: '',
  englishName: '',
  description: '',
  synonyms: '',
  forbiddenWords: '',
  order: '',
});

/**
 * The words keyed by id, from the entities the collection holds in its order;
 * a later entry with the same id replaces an earlier one.
 */
export function createAndMergeWordEntities(
  values: ReadonlyArray<Record<string, unknown>>
): Record<string, Word> {
  const entities: Record<string, Word> = {};

  for (const value of values) {
    const target = createWord();
    const assignString = assign(isString, target, value as DeepPartial<Word>);

    assignString('id');
    assignString('name');
    assignString('abbreviation');
    assignString('englishName');
    assignString('description');
    assignString('synonyms');
    assignString('forbiddenWords');
    assignString('order');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
