import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeDomainEntities,
  createDomain,
} from '@/v3/parser/domain.entity';

describe('createDomain', () => {
  it('creates a domain with every field empty', () => {
    expect(createDomain()).toEqual({
      id: '',
      name: '',
      category: '',
      dataType: '',
      description: '',
    });
  });
});

describe('createAndMergeDomainEntities', () => {
  it('merges every field, keyed by the id', () => {
    const domain = {
      id: 'd1',
      name: '금액N15',
      category: '금액',
      dataType: 'NUMERIC(15)',
      description: 'an amount of money',
    };

    expect(createAndMergeDomainEntities([domain])).toEqual({ d1: domain });
  });

  it('keeps the default of every field that is not a string', () => {
    const entities = createAndMergeDomainEntities([
      { id: 'd1', dataType: 15, category: false },
    ]);

    expect(entities.d1).toEqual({ ...createDomain(), id: 'd1' });
  });

  it('skips an entry without an id', () => {
    expect(createAndMergeDomainEntities([{ id: 3, name: 'x' }])).toEqual({});
  });
});
