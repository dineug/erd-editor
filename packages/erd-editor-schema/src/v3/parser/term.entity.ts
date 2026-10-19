import { isString } from 'es-toolkit';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Term } from '@/v3/schema/term.entity';

export const createTerm = (): Term => ({
  id: '',
  name: '',
  physicalName: '',
  domainId: '',
  description: '',
  synonyms: '',
});

/**
 * The terms keyed by id, from the entities the collection holds in its order;
 * a later entry with the same id replaces an earlier one.
 */
export function createAndMergeTermEntities(
  values: ReadonlyArray<Record<string, unknown>>
): Record<string, Term> {
  const entities: Record<string, Term> = {};

  for (const value of values) {
    const target = createTerm();
    const assignString = assign(isString, target, value as DeepPartial<Term>);

    assignString('id');
    assignString('name');
    assignString('physicalName');
    assignString('domainId');
    assignString('description');
    assignString('synonyms');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
