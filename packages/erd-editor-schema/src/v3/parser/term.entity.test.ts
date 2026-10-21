import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeTermEntities,
  createTerm,
} from '@/v3/parser/term.entity';

describe('createTerm', () => {
  it('creates a term with every field empty and no domain', () => {
    expect(createTerm()).toEqual({
      id: '',
      name: '',
      physicalName: '',
      domainId: '',
      description: '',
      synonyms: '',
      order: '',
    });
  });
});

describe('createAndMergeTermEntities', () => {
  it('merges every field, keyed by the id', () => {
    const term = {
      id: 'tm1',
      name: '회원 번호',
      physicalName: 'MBR_NO',
      domainId: 'd1',
      description: 'the number a member is given',
      synonyms: '회원 ID',
      order: 'a0',
    };

    expect(createAndMergeTermEntities([term])).toEqual({ tm1: term });
  });

  it('keeps the default of every field that is not a string', () => {
    const entities = createAndMergeTermEntities([
      { id: 'tm1', physicalName: 7, domainId: { id: 'd1' } },
    ]);

    expect(entities.tm1).toEqual({ ...createTerm(), id: 'tm1' });
  });

  it('skips an entry without an id', () => {
    expect(createAndMergeTermEntities([{ name: 'no id' }])).toEqual({});
  });
});
