import { isString } from 'es-toolkit';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Domain } from '@/v3/schema/domain.entity';

export const createDomain = (): Domain => ({
  id: '',
  name: '',
  category: '',
  dataType: '',
  description: '',
});

/**
 * The domains keyed by id, from the entities the collection holds in its
 * order; a later entry with the same id replaces an earlier one.
 */
export function createAndMergeDomainEntities(
  values: ReadonlyArray<Record<string, unknown>>
): Record<string, Domain> {
  const entities: Record<string, Domain> = {};

  for (const value of values) {
    const target = createDomain();
    const assignString = assign(isString, target, value as DeepPartial<Domain>);

    assignString('id');
    assignString('name');
    assignString('category');
    assignString('dataType');
    assignString('description');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
