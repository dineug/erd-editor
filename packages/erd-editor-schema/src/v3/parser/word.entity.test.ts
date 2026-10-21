import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeWordEntities,
  createWord,
} from '@/v3/parser/word.entity';

describe('createWord', () => {
  it('creates a word with every field empty', () => {
    expect(createWord()).toEqual({
      id: '',
      name: '',
      abbreviation: '',
      englishName: '',
      description: '',
      synonyms: '',
      forbiddenWords: '',
      order: '',
    });
  });

  it('hands out a new word each time', () => {
    const first = createWord();
    first.name = 'member';

    expect(createWord().name).toBe('');
  });
});

describe('createAndMergeWordEntities', () => {
  it('merges every field, keyed by the id', () => {
    const word = {
      id: 'w1',
      name: '회원',
      abbreviation: 'MBR',
      englishName: 'member',
      description: 'a person who joined',
      synonyms: '멤버, 가입자',
      forbiddenWords: '고객',
      order: 'a0',
    };

    expect(createAndMergeWordEntities([word])).toEqual({ w1: word });
  });

  it('keeps the default of every field that is not a string', () => {
    const entities = createAndMergeWordEntities([
      { id: 'w1', name: 1, abbreviation: null, synonyms: ['a'] },
    ]);

    expect(entities.w1).toEqual({ ...createWord(), id: 'w1' });
  });

  it('skips an entry without an id', () => {
    expect(
      createAndMergeWordEntities([{ name: 'no id' }, { id: '', name: 'x' }])
    ).toEqual({});
  });

  it('lets a later entry with the same id replace an earlier one', () => {
    const entities = createAndMergeWordEntities([
      { id: 'w1', name: 'first' },
      { id: 'w1', name: 'second' },
    ]);

    expect(entities.w1.name).toBe('second');
  });
});
